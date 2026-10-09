"""Bir takım konusuna deneme bildirimi gönderir (FCM).

Telefonda uygulamada o takımı takip ediyorsan ve ilgili bildirim türü açıksa
bildirim gelmeli; Hesap sekmesinden tür kapatılınca gelmemeli.

Kullanım:
  python arka_plan/test_bildirim.py <takım_id> [tür]      tür: gol (varsayılan) | mac | son | hat

FIREBASE_HESAP ortam değişkeni gerekir (servis hesabı JSON'unun base64 hali)
ya da GitHub'da "Deneme bildirimi" iş akışıyla çalıştırılır.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bildirim  # noqa: E402

ORNEK = {
    "gol": ("GOL! Deneme FK", "Deneme FK 1-0 Örnek SK\n23' Deneme Oyuncu"),
    "mac": ("Maç başladı", "Deneme FK - Örnek SK"),
    "son": ("Maç sona erdi", "Deneme FK 2-1 Örnek SK\nKazanan: Deneme FK"),
    "hat": ("Maç 15 dakika sonra başlıyor", "Deneme FK - Örnek SK"),
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    takim_id = sys.argv[1]
    tur = sys.argv[2] if len(sys.argv) > 2 else "gol"
    if tur not in ORNEK:
        sys.exit(f"Bilinmeyen tür: {tur} (gol | mac | son | hat)")
    baslik, govde = ORNEK[tur]
    if not bildirim.gonder((takim_id,), tur, baslik, govde, "deneme", "deneme"):
        sys.exit("Gönderilemedi (FIREBASE_HESAP var mı?)")
    print(f"Gönderildi: t{takim_id}_{tur}")
