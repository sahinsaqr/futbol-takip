# Taraftar — mlkcraft.com/privacy için ek bölüm

Bu metin MLK Craft'ın ortak gizlilik politikasına (https://mlkcraft.com/privacy) Taraftar'a
özel bölüm olarak eklenecek. Uygulama tam metin için o adresi açar; Hesap sekmesindeki kısa
özet `app.js` içindeki `GIZLILIK_OZETI` ile aynı içeriktedir. Metin değişirse ikisini birlikte güncelle.

---

## Türkçe

### Taraftar

Taraftar, takip ettiğin futbol takımlarının maçlarını, skorlarını ve puan durumunu gösteren
ücretsiz bir uygulamadır (Android uygulaması `com.sahin.taraftar` ve web sürümü).

**Spor verileri.** Maç, skor, fikstür ve puan durumu bilgileri üçüncü taraf spor veri
kaynaklarından alınır ve GitHub Pages üzerinden sunulur. Bu verileri alırken senin hakkında bir
bilgi göndermeyiz; barındırma hizmeti (GitHub) teknik kayıtlar (ör. IP adresi) tutabilir.

**Takip edilen takımlar ve bildirim ayarları.** Uygulamayı kullanmak için hesap açman gerekmez;
ilk açılışta anonim bir hesap oluşturulur. Takip ettiğin takımlar ve bildirim ayarların
(goller, maç başladı / devre arası, maç sonucu, maçtan önce hatırlatma) cihazında ve Google
Firebase (Cloud Firestore, Avrupa – eur3) sunucularında hesabına bağlı olarak saklanır. Google ile
giriş yaparsan adın, e-posta adresin ve profil fotoğrafın yalnızca hesabını tanımak ve takımlarını
cihazların arasında eşitlemek için kullanılır.

**Bildirim belirteci.** Android uygulamasında bildirimlere izin verirsen cihazın Firebase Cloud
Messaging'den bir bildirim belirteci alır ve takip ettiğin takımların bildirim konularına
(ör. bir takımın gol bildirimleri) abone olur. Sunucumuz kimin hangi takımı takip ettiğini bilmez;
bildirimler takım konularına gönderilir. Bir bildirim türünü kapattığında ya da takımı
çıkardığında ilgili konudan çıkılır.

**Reklam ve analiz.** Taraftar'da reklam, analiz (istatistik) ya da çökme raporlama aracı yoktur.

**Hesabını ve verilerini silme.** Uygulamada **Hesap → Hesabımı sil** ile buluttaki ve cihazındaki
takım listeni, bildirim ayarlarını ve hesabını istediğin an kalıcı olarak silebilirsin; cihazın
tüm bildirim konularından da çıkarılır. Çıkış yaptığında takımların o cihazdan kaldırılır,
Google hesabında kalır. Uygulamaya erişemiyorsan giriş yaptığın e-posta adresiyle
info@mlkcraft.com adresine yazabilirsin.

---

## English

### Taraftar

Taraftar is a free app that shows matches, scores and standings for the football teams you
follow (Android app `com.sahin.taraftar` and a web version).

**Sports data.** Match, score, fixture and standings information comes from third-party sports
data sources and is served via GitHub Pages. We do not send any information about you to fetch
this data; the hosting provider (GitHub) may keep technical logs (e.g. IP address).

**Followed teams and notification settings.** You do not need to create an account to use the
app; an anonymous account is created when it first opens. The teams you follow and your
notification settings (goals, kick-off / half-time, final result, pre-match reminder) are stored on
your device and on Google Firebase servers (Cloud Firestore, Europe – eur3), linked to your
account. If you sign in with Google, your name, email address and profile photo are used only to
identify your account and sync your teams across your devices.

**Notification token.** If you allow notifications in the Android app, your device receives a
notification token from Firebase Cloud Messaging and subscribes to the notification topics of the
teams you follow (e.g. a team's goal alerts). Our server does not know who follows which team;
notifications are sent to team topics. When you turn off a notification type or remove a team,
the device unsubscribes from the related topic.

**Ads and analytics.** Taraftar contains no ads, analytics or crash reporting tools.

**Deleting your account and data.** In the app, go to **Hesap (Account) → Hesabımı sil (Delete my
account)** to permanently delete your team list, notification settings and account from the cloud
and your device at any time; your device is also unsubscribed from all notification topics.
Signing out removes your teams from that device; they remain in your Google account. If you
cannot access the app, email info@mlkcraft.com from the address you signed in with.
