# e-Nabız Userscript Araç Seti

Bu depo, hekimlerin e-Nabız üzerindeki hasta değerlendirme süreçlerini hızlandırmak, klinik verileri normalize etmek ve kayıtları yapay zeka (LLM/Claude/GPT) analizine uygun formatlarda dışa aktarmak için geliştirilmiş Tampermonkey kullanıcı betiklerini (userscripts) içerir.

---

## Hızlı Kurulum

1. Tarayıcınıza [Tampermonkey](https://www.tampermonkey.net/) uzantısını kurun.
2. İlgili araca tıklayarak tek tıkla yükleyin:

| Araç Adı | Kapsam | Çıktı Formatı | Kurulum Bağlantısı |
| :--- | :--- | :--- | :--- |
| **Görüntü Raporları Aktarıcı** | Radyoloji / Görüntüleme Raporları | `.md` (Markdown) | [📥 Scripti Kur](https://github.com/keagenmert/enabiz-userscripts/raw/main/enabiz-goruntu-rapor-aktarici.user.js) |
| **Klinik Veri Aktarıcı** | Tahliller, Epikrizler, Tanılar, İlaçlar | `.csv` (Normalize CSV) | [📥 Scripti Kur](https://github.com/keagenmert/enabiz-userscripts/raw/main/enabiz-klinik-veri-aktarici.user.js) |

---

## Script Özellikleri ve Kapsamı

### 1. Görüntü Raporları Dışa Aktarıcı (`.md`)
* **Kapsam:** `/DoktorErisim/Goruntuler*`
* **DataTables Sayfalama:** Sayfalardaki tüm radyoloji kayıtlarını arka planda tek tek tarar.
* **Klinik Bölümleme:** Rapor metinlerini `Bulgular`, `Sonuç ve Öneriler`, `Karşılaştırma`, `İzlenim` başlıklarına ayrıştırarak okunabilir Markdown blokları üretir.
* **De-identification (KVKK / Maskeleme):** T.C. Kimlik Numarası, hasta adı ve doğum tarihi gibi doğrudan tanımlayıcıları istemci tarafında maskeler.

---

### 2. Klinik Veri Dışa Aktarıcı (`.csv`)
* **Kapsam:** Tahliller, Epikrizler, Tanılar ve İlaçlar sayfaları.
* **Tahliller:** Sayısal sonuçları, operatörleri (`<`, `>`), referans aralıklarını ve patolojik bayrakları (`Düşük`, `Yüksek`) ayrıştırır. Panel/grup hiyerarşisini korur.
* **Epikrizler:** Ziyaret zaman çizelgesini korur; epikriz metinlerini satır sonlarını bozmadan aktarır.
* **Tanılar:** ICD-10 kodlarını ve tanı rollerini (Ana Tanı, Ek Tanı, Ön Tanı, Ayırıcı Tanı) satır bazında normalize eder.
* **İlaçlar:** Dozaj, kullanım sıklığı ve etken madde/ürün ailesi standardizasyonu yapar.

---

## Kullanım Adımları

1. e-Nabız hekim arayüzünde ilgili sayfaya gidin.
2. Sayfada beliren yeşil **`Raporları İndir (AI-MD)`** veya **`CSV İndir (Klinik)`** butonuna tıklayın.
3. Otomasyon arka plan verilerini toplarken bekleyin.
4. Dosya otomatik olarak bilgisayarınıza indirilecektir.

---

## Güvenlik ve Gizlilik Bildirimi
* Bu betikler tamamen **istemci tarafında (tarayıcı üzerinde)** çalışır.
* Hiçbir harici API'ye veya üçüncü taraf sunucuya veri aktarımı yapılmaz.
* Yalnızca oturumu açmış yetkili hekimin tarayıcı oturumunda lokal bellek üzerinden işlem gerçekleştirilir.
* Açık kaynaklıdır; kodları inceleyebilir ve yerel ortamınıza göre yapılandırabilirsiniz.

---

## 📄 Lisans
Bu proje [MIT Lisansı](LICENSE) altında sunulmaktadır.
