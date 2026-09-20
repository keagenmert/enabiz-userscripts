# e-Nabız Userscript Araçları

Bu depo, hekimlerin e-Nabız üzerindeki klinik veri akışını hızlandırmak ve kayıtları yapılandırılmış formatlarda dışa aktarmak için geliştirilmiş Tampermonkey kullanıcı betiklerini (userscript) içerir.

---

## 🚀 Hızlı Kurulum

1. Tarayıcınıza [Tampermonkey](https://www.tampermonkey.net/) eklentisini kurun.
2. Aşağıdaki kurulum bağlantılarından birine tıklayın (Tampermonkey otomatik olarak algılayıp onay ekranını açacaktır):

| Script | Açıklama | Kurulum |
|--------|----------|---------|
| **Klinik Veri Aktarıcı** | Tahlil, epikriz, tanı ve ilaç verilerini CSV formatında indirir | [📥 Yükle](https://github.com/keagenmert/enabiz-userscripts/raw/main/enabiz-klinik-veri-aktarici.user.js) |
| **Görüntü Raporları Aktarıcı** | Radyoloji raporlarını AI-analizi için Markdown formatında indirir | [📥 Yükle](https://github.com/keagenmert/enabiz-userscripts/raw/main/enabiz-goruntu-rapor-aktarici.user.js) |

---

## 🛠 Script Özellikleri

### 1. Klinik Veri Dışa Aktarıcı (CSV)
* **Çoklu Sayfa Desteği:** Tahlil, epikriz, tanı ve ilaç sayfalarında çalışır
* **Otomatik Sayfalama:** "Daha Fazla Yükle" butonlarını otomatik tıklar, tüm kayıtları toplar
* **Veri Normalizasyonu:** Tarihleri ISO formatına dönüştürür, sayısal değerleri parse eder
* **Anonimleştirme:** Hasta adı, TC kimlik no ve doğum tarihini maskeleyebilir
* **Duplikasyon Tespiti:** Tamamen aynı kayıtları sayar ve işaretler
* **İlaç Normalizasyonu:** İlaç isimlerini normalize eder, ürün ailesi bazında gruplar
* **Tanı Ayrıştırma:** ICD kodlu tanıları otomatik ayırır

**Desteklenen Sayfalar:**
- `/DoktorErisim/Tahliller`
- `/DoktorErisim/Epikrizler`
- `/DoktorErisim/Tanilar`
- `/DoktorErisim/Ilaclar`

### 2. Görüntü Raporları Dışa Aktarıcı (AI-MD)
* **Sayfalama Otomasyonu:** DataTables üzerindeki tüm sayfaları sırayla gezerek tüm radyoloji kayıtlarını toplar
* **Bölümleme Algoritması:** Rapor metinlerini standart klinik başlıklara (`Bulgular`, `Sonuç ve Öneriler`, `Karşılaştırma`, `İzlenim` vb.) ayırır
* **Gizlilik ve Anonimizasyon:** Varsayılan olarak T.C. Kimlik No, hasta adı ve doğum tarihi gibi doğrudan tanımlayıcıları maskeler
* **Markdown Çıktısı:** AI analizi için optimize edilmiş yapılandırılmış `.md` dosyası üretir

**Desteklenen Sayfalar:**
- `/DoktorErisim/Goruntuler`

---

## 📋 Kullanım

### Klinik Veri Aktarıcı
1. e-Nabız hekim arayüzünde ilgili sayfaya gidin (Tahliller, Epikrizler, Tanılar veya İlaçlar)
2. Tablo başlığının yanında beliren yeşil **`CSV İndir (Klinik)`** butonuna tıklayın
3. Tüm sayfalar yüklenirken bekleyin; işlem bittiğinde CSV dosyası otomatik olarak indirilecektir

### Görüntü Raporları Aktarıcı
1. e-Nabız hekim arayüzünde **Görüntüler** sayfasına (`/DoktorErisim/Goruntuler`) gidin
2. Tablo başlığının yanında beliren yeşil **`Raporları İndir (AI-MD)`** butonuna tıklayın
3. Raporlar taranırken bekleyin; işlem bittiğinde Markdown dosyası otomatik olarak indirilecektir

---

## ⚙️ Yapılandırma

Her iki script de `CONFIG` objesi üzerinden özelleştirilebilir:

```javascript
const CONFIG = Object.freeze({
    MASK_DIRECT_IDENTIFIERS: true,      // Kimlik maskeleme aktif/pasif
    MAX_LOAD_MORE_CLICKS: 200,          // Maksimum "daha fazla yükle" tıklaması
    LOADER_TIMEOUT_MS: 20000,           // Loader bekleme süresi (ms)
    PAGE_TIMEOUT_MS: 10000,             // Sayfa değiştirme timeout (ms)
    EXCLUDE_EMPTY_EPIKRIZ_ROWS: false,  // Boş epikriz satırlarını atla
    PRESERVE_NARRATIVE_LINE_BREAKS: true, // Metinlerde satır sonlarını koru
    CHUNK_SIZE: 500,                    // Büyük veri setleri için chunk boyutu
});
```

---

## 🔒 Güvenlik ve Gizlilik

* **Yerel İşleme:** Tüm veri işleme ve maskeleme işlemleri tarayıcı belleğinde gerçekleşir
* **Harici İletişim Yok:** Hiçbir veri harici sunucuya gönderilmez
* **Yetki Bazlı:** Sadece yetkili hekim erişimi bulunan oturumlarda çalışır
* **Minimal İzinler:** `@grant none` ile minimum gerekli izinler kullanılır

---

## 🧪 Teknik İyileştirmeler (v4.1.0+)

| Kategori | İyileştirme |
|----------|-------------|
| **Performans** | `exactDuplicateCounts()` fonksiyonu hash-based yaklaşımla optimize edildi |
| **Erişilebilirlik** | Butonlara `aria-label` özniteliği eklendi |
| **Güncellenebilirlik** | `@updateURL` ve `@downloadURL` metadata eklendi |
| **DOM Ready** | `DOMContentLoaded` event handler ile güvenli başlatma |
| **Kod Organizasyonu** | Fonksiyonlar kategorilere ayrıldı, yorum satırları eklendi |

---

## 📝 Sürüm Geçmişi

### v4.1.0 (Mevcut)
- ✅ Performance optimizasyonu: duplicate detection hash-based yaklaşım
- ✅ Accessibility: aria-label desteği
- ✅ Auto-update: updateURL ve downloadURL metadata
- ✅ DOM ready handling iyileştirildi
- ✅ Kod organizasyonu ve dokümantasyon

### v4.0.0
- İlk stabil sürüm

---

## ⚠️ Sorumluluk Reddi

* Bu araçlar yalnızca yetkili hekim erişimi bulunan oturumlarda arayüz kolaylığı sağlamak amacıyla istemci tarafında (tarayıcıda) çalışır.
* KVKK ve hasta gizliliği sorumluluğu kullanıcıya aittir.
* Anonimleştirme özellikleri varsayılan olarak aktif olsa da, kesin anonimlik garantisi verilmez.

---

## 📄 Lisans

MIT License - Detaylar için [LICENSE](LICENSE) dosyasına bakınız.
