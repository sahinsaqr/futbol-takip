# Taraftar

Takip ettiğin takımların canlı skorları, fikstürü ve puan durumu. Bilgisayarda ve iPhone'da çalışır, maç sırasında telefona bildirim gönderir.

## Nasıl çalışır?

```
ESPN ──► GitHub Actions (Python) ──► veri/*.json ──► Web uygulaması (GitHub Pages)
                     │
                     └──► ntfy ──► telefona bildirim
```

- **arka_plan/** — GitHub'da her 30 dakikada bir çalışan Python programı.
  - Fikstür, sonuçlar ve puan durumunu günde bir kez tamamen, 3 saatte bir kısaca günceller.
  - `takip.json` içindeki takımların maçı yaklaşınca maç bitene kadar dakikada bir skoru kontrol eder ve bildirim gönderir. Maç yoksa hemen kapanır.
- **index.html, app.js, style.css** — Web uygulaması. Takım ekleme, maçlar, canlı skor ve puan durumu.
- **ayarlar.json** — Hangi liglerin takip edileceği. ESPN lig koduyla yeni lig eklenebilir.
- **takip.json** — Bildirim gelecek takımlar.

## Kurulum (bir kez)

1. **Depo:** GitHub'da `taraftar` adında **Public** (herkese açık) bir depo aç ve bu klasördeki tüm dosyaları yükle (`.github` klasörü dahil).
2. **Bildirim konusu:** Depoda *Settings → Secrets and variables → Actions → New repository secret*
   - Name: `NTFY_KONU`
   - Secret: tahmin edilmesi zor bir ad, ör. `futbol-sahiner-x7k2q9`
3. **(İsteğe bağlı)** Aynı sayfada *Variables* sekmesi → `UYGULAMA_ADRESI` = `https://taraftar.mlkcraft.com/` (bildirime dokununca uygulama açılır).
4. **İlk veri:** *Actions* sekmesi → gerekiyorsa iş akışlarını etkinleştir → **Taraftar verisi ve maç izleme** → **Run workflow** → mod: `tam`. 5-10 dakika sürer.
5. **Yayın:** *Settings → Pages → Build and deployment*: Source **Deploy from a branch**, Branch **main**, klasör **/ (root)** → Save.
   Birkaç dakika sonra uygulama `https://taraftar.mlkcraft.com/` adresinde açılır.
6. **iPhone:** Adresi Safari'de aç → Paylaş → **Ana Ekrana Ekle**.
7. **Bildirim:** Telefona **ntfy** uygulamasını kur → **+** → 2. adımdaki konu adına abone ol.

## Bildirim takımlarını değiştirme

Uygulamada takımları ekle, sonra **Bildirim** sekmesindeki metni kopyalayıp GitHub'daki `takip.json` dosyasına yapıştır.

## Notlar

- Veriler ESPN'in herkese açık ama resmi olmayan adreslerinden gelir. ESPN yapıyı değiştirirse `arka_plan/espn.py` güncellenmelidir.
- ESPN Türkiye'den doğrudan erişime kapalı olduğu için veriler GitHub sunucularında çekilir; bu yüzden program bilgisayarda yerel olarak veri çekemez.
- GitHub zamanlanmış görevleri birkaç dakika gecikebilir. Maç izleyici bu yüzden maçtan önce başlar ve bekler.
- Hata olursa *Actions* sekmesinde görevin kayıtlarına bak. "Permission denied" hatasında *Settings → Actions → General → Workflow permissions* → **Read and write permissions** seç.
