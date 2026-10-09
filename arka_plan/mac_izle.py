"""Zamanlanmış görevin ana programı.

1. Verileri gerekiyorsa günceller (fikstür, sonuçlar, puan durumu).
2. Takip edilen takımların yakında başlayacak ya da oynanmakta olan maçı
   varsa maç bitene kadar dakikada bir skoru kontrol eder ve ntfy ile
   bildirim gönderir. Maç yoksa hemen kapanır.

Ortam değişkenleri:
  NTFY_KONU         : ntfy bildirim konusu (GitHub'da gizli anahtar olarak)
  UYGULAMA_ADRESI   : bildirime tıklayınca açılacak adres (isteğe bağlı)
  KONTROL_ARALIGI   : kaç saniyede bir kontrol (varsayılan 60)
"""
import json
import os
import time
import urllib.request
from collections import defaultdict
from datetime import timedelta

import espn
import veri_guncelle
from ortak import (VERI, git_gonder, iso, json_oku, json_yaz, simdi,
                   takip_edilenler, zaman_oku)

ILERI_BAK = timedelta(minutes=80)       # bu süre içinde başlayacak maçları bekle
HATIRLATMA = timedelta(minutes=15)      # maçtan bu kadar önce hatırlat
AZAMI_SURE = timedelta(hours=5, minutes=30)   # GitHub sınırı 6 saat
KONTROL = int(os.environ.get("KONTROL_ARALIGI", "60"))
GONDERIM_ARALIGI = timedelta(minutes=4)  # skor değişmese de canlı dakikayı güncelle

BITTI = {"STATUS_FULL_TIME", "STATUS_FINAL", "STATUS_FINAL_AET", "STATUS_FINAL_PEN",
         "STATUS_END_OF_EXTRATIME"}
ERTELENDI = {"STATUS_POSTPONED", "STATUS_CANCELED", "STATUS_ABANDONED",
             "STATUS_SUSPENDED", "STATUS_DELAYED", "STATUS_FORFEIT"}


# ------------------------------------------------------------ bildirim

def bildir(baslik, mesaj, etiketler=("soccer",), oncelik=4):
    print(f"[BİLDİRİM] {baslik} | {mesaj}")
    konu = os.environ.get("NTFY_KONU", "").strip()
    if not konu:
        return
    govde = {"topic": konu, "title": baslik, "message": mesaj,
             "tags": list(etiketler), "priority": oncelik}
    adres = os.environ.get("UYGULAMA_ADRESI", "").strip()
    if adres:
        govde["click"] = adres
    istek = urllib.request.Request(
        "https://ntfy.sh/", data=json.dumps(govde).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        urllib.request.urlopen(istek, timeout=15).read()
    except Exception as h:
        print(f"  bildirim gönderilemedi: {h}")


def skor_metni(m):
    return f"{m['ev']['ad']} {m['ev_skor'] or 0}-{m['dep_skor'] or 0} {m['dep']['ad']}"


def eslesme(m):
    return f"{m['ev']['ad']} - {m['dep']['ad']}"


class Bildirici:
    """Aynı olay için iki kez bildirim gönderilmesini engeller."""

    def __init__(self, gonderilenler):
        self.gonderilenler = set(gonderilenler)

    def bir_kez(self, anahtar, *args, **kw):
        if anahtar in self.gonderilenler:
            return False
        self.gonderilenler.add(anahtar)
        bildir(*args, **kw)
        return True


def degisiklikleri_bildir(b, eski, yeni):
    """Eski ve yeni maç durumunu karşılaştırıp gereken bildirimleri gönderir."""
    mid = yeni["id"]
    kod = yeni["durum_kodu"]

    if kod in ERTELENDI:
        b.bir_kez(f"{mid}:ertelendi", "Maç ertelendi / durduruldu",
                  f"{eslesme(yeni)}", ("warning",))
        return

    if yeni["durum"] == "pre":
        bas = zaman_oku(yeni["tarih"])
        if bas and timedelta(0) < bas - simdi() <= HATIRLATMA:
            dk = int((bas - simdi()).total_seconds() // 60) + 1
            b.bir_kez(f"{mid}:hatirlat", f"Maç {dk} dakika sonra başlıyor",
                      eslesme(yeni), ("alarm_clock",), 3)
        return

    b.bir_kez(f"{mid}:basladi", "Maç başladı", eslesme(yeni), ("soccer",))

    # Goller: skor arttıysa gol, azaldıysa iptal
    eski_ev = (eski or {}).get("ev_skor") or 0
    eski_dep = (eski or {}).get("dep_skor") or 0
    ev, dep = yeni["ev_skor"] or 0, yeni["dep_skor"] or 0
    if (ev, dep) != (eski_ev, eski_dep):
        if ev >= eski_ev and dep >= eski_dep:
            atan = yeni["ev"] if ev > eski_ev else yeni["dep"]
            atan_skor = ev if atan is yeni["ev"] else dep
            ayrinti = ""
            goller = [g for g in yeni.get("goller", []) if g["takim"] == atan["id"]]
            # Gol listesi skorla uyuşuyorsa son golün sahibini yaz
            if goller and len(goller) == atan_skor:
                g = goller[-1]
                ek = " (kendi kalesine)" if g["kk"] else " (penaltı)" if g["pen"] else ""
                ayrinti = f"\n{g['dk']} {g['oyuncu']}{ek}".rstrip()
            b.bir_kez(f"{mid}:skor:{ev}-{dep}", f"GOL! {atan['ad']}",
                      skor_metni(yeni) + ayrinti, ("soccer", "tada"), 5)
        else:
            b.bir_kez(f"{mid}:iptal:{ev}-{dep}", "Gol iptal / skor düzeltildi",
                      skor_metni(yeni), ("x",))
            # İptal edilen skor tekrar olursa yeniden bildirilebilsin
            b.gonderilenler.discard(f"{mid}:skor:{eski_ev}-{eski_dep}")
            b.gonderilenler.discard(f"{mid}:iptal:{ev}-{dep}")

    if kod == "STATUS_HALFTIME":
        b.bir_kez(f"{mid}:devre", "Devre arası", skor_metni(yeni), ("hourglass",), 3)

    if yeni["durum"] == "post" or kod in BITTI:
        if ev == dep:
            sonuc = "Berabere"
        else:
            sonuc = f"Kazanan: {(yeni['ev'] if ev > dep else yeni['dep'])['ad']}"
        b.bir_kez(f"{mid}:bitti", "Maç sona erdi", f"{skor_metni(yeni)}\n{sonuc}",
                  ("checkered_flag",))


# ------------------------------------------------------------- izleme

def takip_maclari(takimlar):
    """Lig dosyalarından takip edilen takımların maçlarını toplar."""
    maclar = {}
    for dosya in VERI.glob("lig_*.json"):
        for m in (json_oku(dosya, {}) or {}).get("maclar", []):
            if m["ev"]["id"] in takimlar or m["dep"]["id"] in takimlar:
                maclar[m["id"]] = m
    return maclar


def izlenecek_mi(m, su_an):
    """Maç şu an izlenmeli mi, yoksa yakında mı başlayacak?"""
    bas = zaman_oku(m.get("tarih"))
    if not bas or m.get("durum_kodu") in ERTELENDI:
        return False
    if m.get("durum") == "post":
        return False
    if m.get("durum") == "in":
        return True
    # başlamamış: yakında başlıyorsa ya da başlaması gerekip veri eskiyse
    return bas - ILERI_BAK <= su_an <= bas + timedelta(hours=4)


def guncel_durum_getir(m):
    """Maçın son durumunu ESPN'den getirir."""
    bas = zaman_oku(m["tarih"])
    for gun in (bas.date(), bas.date() - timedelta(days=1)):
        for yeni in espn.gun_maclari(m["lig"], gun):
            if yeni["id"] == m["id"]:
                return yeni
    return None


def izle():
    takimlar = takip_edilenler()
    if not takimlar:
        print("takip.json içinde takım yok; izleme yapılmayacak.")
        return

    canli = json_oku(VERI / "canli.json", {}) or {}
    b = Bildirici(canli.get("bildirilenler", []))
    son_durum = {m["id"]: m for m in canli.get("maclar", [])}

    baslangic = simdi()
    son_gonderim = simdi() - GONDERIM_ARALIGI
    izlenen_var = False

    while simdi() - baslangic < AZAMI_SURE:
        su_an = simdi()
        maclar = takip_maclari(takimlar)
        # izleme sırasında öğrendiğimiz en güncel durumu kullan
        for mid, m in son_durum.items():
            if mid in maclar:
                maclar[mid] = m
        adaylar = [m for m in maclar.values() if izlenecek_mi(m, su_an)]
        if not adaylar:
            break

        izlenen_var = True
        aktif = [m for m in adaylar
                 if zaman_oku(m["tarih"]) - HATIRLATMA - timedelta(minutes=2) <= su_an]
        if not aktif:
            ilk = min(zaman_oku(m["tarih"]) for m in adaylar)
            bekle = (ilk - HATIRLATMA - timedelta(minutes=1) - su_an).total_seconds()
            bekle = max(30, min(bekle, 600))
            print(f"Sıradaki maç {ilk:%H:%M} UTC; {int(bekle)} sn bekleniyor.")
            time.sleep(bekle)
            continue

        degisti = False
        # Aynı lig ve gündeki maçları tek istekte almak için grupla
        gruplar = defaultdict(list)
        for m in aktif:
            gruplar[(m["lig"], zaman_oku(m["tarih"]).date())].append(m)
        for (lig, gun), liste in gruplar.items():
            try:
                gunun = {x["id"]: x for x in espn.gun_maclari(lig, gun)}
            except espn.VeriHatasi as h:
                print(f"Kontrol hatası: {h}")
                continue
            for m in liste:
                yeni = gunun.get(m["id"]) or guncel_durum_getir(m)
                if not yeni:
                    continue
                eski = son_durum.get(m["id"])
                degisiklikleri_bildir(b, eski, yeni)
                if not eski or (eski.get("ev_skor"), eski.get("dep_skor"), eski.get("durum_kodu")) != \
                        (yeni["ev_skor"], yeni["dep_skor"], yeni["durum_kodu"]):
                    degisti = True
                son_durum[m["id"]] = yeni
                print(f"{yeni['dakika'] or yeni['durum']:>6} {skor_metni(yeni)}")

        canli_yaz(son_durum, b)
        if degisti or simdi() - son_gonderim >= GONDERIM_ARALIGI:
            git_gonder("Canlı skor güncellendi")
            son_gonderim = simdi()
        time.sleep(KONTROL)

    if izlenen_var:
        canli_yaz(son_durum, b)
        veri_guncelle.guncelle("hizli")
        git_gonder("Maç sonrası veriler güncellendi")


def canli_yaz(son_durum, b):
    sinir = simdi() - timedelta(hours=12)
    maclar = [m for m in son_durum.values()
              if (zaman_oku(m.get("tarih")) or simdi()) >= sinir]
    ids = {m["id"] for m in maclar}
    # bildirim kayıtlarını son maçlarla sınırlı tut
    bildirilenler = sorted(k for k in b.gonderilenler if k.split(":")[0] in ids)
    json_yaz(VERI / "canli.json", {"guncelleme": iso(), "maclar": maclar,
                                   "bildirilenler": bildirilenler})


if __name__ == "__main__":
    veri_guncelle.guncelle("otomatik")
    git_gonder("Fikstür ve puan durumu güncellendi")  # değişiklik yoksa bir şey yapmaz
    izle()
