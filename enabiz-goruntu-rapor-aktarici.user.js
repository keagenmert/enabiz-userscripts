# e-Nabız Userscript Araçları

Bu depo, hekimlerin e-Nabız üzerindeki klinik veri akışını hızlandırmak ve kayıtları yapılandırılmış formatlarda dışa aktarmak için geliştirilmiş Tampermonkey kullanıcı betiklerini (userscript) içerir.

---

## 🚀 Hızlı Kurulum

1. Tarayıcınıza [Tampermonkey](https://www.tampermonkey.net/) eklentisini kurun.
2. Aşağıdaki kurulum bağlantısına tıklayın (Tampermonkey otomatik olarak algılayıp onay ekranını açacaktır):
   * 📥 [e-Nabız Görüntü Raporları Dışa Aktarıcı'yı Yükle](https://github.com/keagenmert/enabiz-userscripts/raw/main/enabiz-goruntu-rapor-aktarici.user.js)

---

## 🛠 Script Özellikleri

### 1. Görüntü Raporları Dışa Aktarıcı (AI-uyumlu Markdown)
* **Sayfalama Otomasyonu:** DataTables üzerindeki tüm sayfaları sırayla gezerek arka plandaki tüm radyoloji kayıtlarını eksiksiz toplar.
* **Bölümleme Algoritması:** Rapor metinlerini standart klinik başlıklara (`Bulgular`, `Sonuç ve Öneriler`, `Karşılaştırma`, `İzlenim` vb.) ayırır.
* **Gizlilik ve Anonimizasyon (De-identification):** Varsayılan olarak T.C. Kimlik No, hasta adı ve doğum tarihi gibi doğrudan tanımlayıcıları maskeleyerek yapay zeka analizine uygun hale getirir.
* **Dışa Aktarma:** Tek tıkla tarih damgalı `.md` (Markdown) dosyası üretir.

---

## 📋 Kullanım

1. e-Nabız hekim arayüzünde **Görüntüler** sayfasına (`/DoktorErisim/Goruntuler`) gidin.
2. Tablo başlığının yanında beliren yeşil **`Raporları İndir (AI-MD)`** butonuna tıklayın.
3. Raporlar taranırken bekleyin; işlem bittiğinde Markdown dosyası otomatik olarak indirilecektir.

---

## ⚠️ Sorumluluk Reddi ve Güvenlik
* Bu araçlar yalnızca yetkili hekim erişimi bulunan oturumlarda arayüz kolaylığı sağlamak amacıyla istemci tarafında (tarayıcıda) çalışır.
* Hiçbir harici sunucuya veri göndermez; tüm veri işleme ve maskeleme işlemleri yerel tarayıcı belleğinde gerçekleşir.