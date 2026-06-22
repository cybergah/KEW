# Kew — Word article (Turkish) for the website. Cybergah Group.
import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
SHOTS=os.path.join(ROOT,"assets","shots","tr"); LOGO=os.path.join(ROOT,"src","assets","logo.png")
OUT=os.path.join(ROOT,"Kew-Tanitim-Haber.docx")

GOLD=RGBColor(0x9a,0x7d,0x2e); GREEN=RGBColor(0x16,0x3a,0x25); GREY=RGBColor(0x55,0x60,0x58)

d=Document()
st=d.styles["Normal"]; st.font.name="Calibri"; st.font.size=Pt(11)

def h(text,size,color=None,bold=True,align=None,space=6):
    p=d.add_paragraph(); r=p.add_run(text); r.bold=bold; r.font.size=Pt(size)
    if color is not None: r.font.color.rgb=color
    if align is not None: p.alignment=align
    p.paragraph_format.space_after=Pt(space); return p

def para(text,size=11,italic=False,color=None,align=None,space=8):
    p=d.add_paragraph(); r=p.add_run(text); r.italic=italic; r.font.size=Pt(size)
    if color is not None: r.font.color.rgb=color
    if align is not None: p.alignment=align
    p.paragraph_format.space_after=Pt(space); return p

def img(path,width=5.4,align=WD_ALIGN_PARAGRAPH.CENTER,cap=None):
    p=d.add_paragraph(); p.alignment=align; p.add_run().add_picture(path,width=Inches(width))
    if cap: para(cap,9,italic=True,color=GREY,align=WD_ALIGN_PARAGRAPH.CENTER,space=10)

# ---- header ----
pic=d.add_paragraph(); pic.alignment=WD_ALIGN_PARAGRAPH.CENTER; pic.add_run().add_picture(LOGO,width=Inches(1.3))
h("KEW",30,GOLD,align=WD_ALIGN_PARAGRAPH.CENTER,space=2)
para("Anonim ve Ücretsiz Video İndirici",14,italic=True,color=GREEN,align=WD_ALIGN_PARAGRAPH.CENTER,space=2)
para("Cybergah Group  ·  cybergah.com  ·  Açık Kaynak (GPL-3.0)",10,color=GREY,align=WD_ALIGN_PARAGRAPH.CENTER,space=14)

# ---- lede ----
para("Cybergah Group, internette mahremiyet ve özgür erişim ilkesiyle geliştirdiği yeni mobil "
     "uygulaması Kew’i yayınladı. Kürtçede ‘keklik’ anlamına gelen Kew; YouTube, X (Twitter), "
     "TikTok ve Instagram’dan video indirmeyi tek bir linkle, hesap açmadan ve hiçbir iz bırakmadan "
     "mümkün kılıyor. Uygulama tamamen ücretsiz ve açık kaynaktır.",12)

h("Amaç: Özgür ve Anonim Erişim",16,GREEN)
para("Kew’in çıkış noktası basit bir inanç: bilgiye ve içeriğe erişim özgür ve anonim olmalıdır. "
     "Uygulama hiçbir kişisel veri toplamaz, kullanıcı hesabı istemez, reklam göstermez ve kullanıcıyı "
     "takip etmez. İndirilen tüm içerik yalnızca kullanıcının cihazında kalır. Video çözümleme işlemi "
     "bir sunucuya gönderilmeden, doğrudan telefonun içinde açık kaynaklı yt-dlp motoruyla yapılır; "
     "böylece üçüncü taraf hiçbir hizmete bağımlılık ve veri sızıntısı riski oluşmaz.")
img(os.path.join(SHOTS,"home.png"),width=2.6,cap="Ana ekran: linki yapıştır, platform otomatik tanınır, önizleme ile indir.")

h("Öne Çıkan Özellikler",16,GREEN)
for b in [
 "Dört platform: YouTube, X, TikTok ve Instagram — link yapıştır, indir.",
 "YouTube oynatma listeleri: her video ayrı indirilir; tümü tek tuşla duraklatılıp iptal edilebilir.",
 "Video veya yalnızca ses (MP3) indirme; Max/1080/720/480 kalite seçimi.",
 "İndirilenler doğrudan ‘İndirilenler/Kew’ klasörüne kaydedilir; dahili oynatıcı ile izlenir.",
 "Arka planda indirme: uygulama kapalıyken bile sürer, bittiğinde keklik sesiyle bildirim gelir.",
 "Beş dil: Kürtçe, Türkçe, Arapça, İngilizce ve Farsça (Arapça/Farsça için sağdan-sola arayüz).",
 "Otomatik yeniden deneme: inmeyen video atlanmaz, tekrar denenir.",
]:
    p=d.add_paragraph(style="List Bullet"); p.add_run(b).font.size=Pt(11)
d.add_paragraph()
img(os.path.join(SHOTS,"downloads.png"),width=2.6,cap="İndirilenler: oynatma listesi grubu, ilerleme, duraklat/iptal ve durum bilgisi.")

h("Nasıl Çalışır?",16,GREEN)
para("Kew, modern bir React arayüzünü Android üzerinde Capacitor ile paketler. Çıkarma ve indirme "
     "işini, dünya çapında 1000’den fazla siteyi destekleyen açık kaynaklı yt-dlp motoru cihaz "
     "üzerinde yürütür ve kendini güncel tutar. Bu sayede platformlar değişse bile uygulama çalışmaya "
     "devam eder ve hiçbir aracı sunucuya ihtiyaç duymaz.")

h("Çok Dilli ve Erişilebilir",16,GREEN)
para("Arayüz beş dilde sunulur ve anında değiştirilebilir. Arapça ve Farsça için tam sağdan-sola "
     "düzen desteklenir. Tasarım, Kürt dağlarının özgür kuşu keklikten ilham alan yeşil-altın bir "
     "kimlik taşır.")
img(os.path.join(SHOTS,"settings.png"),width=2.6,cap="Ayarlar: dil seçimi, bildirim ve keklik sesi, gizlilik manifestosu.")

h("Gizlilik ve Özgürlük",16,GREEN)
para("Kew, GPL-3.0 lisansıyla açık kaynak olarak yayınlanır; kaynak kodu herkese açıktır, incelenebilir "
     "ve geliştirilebilir. Cybergah Group, özgür ve anonim bir internet vizyonuyla, kâr amacı gütmeden "
     "bu aracı topluluğa sunar.", color=None)
para("“Bilgiye erişim özgür ve anonim olmalı.” — Cybergah Group", italic=True, color=GOLD)

# footer
d.add_paragraph()
para("İletişim: info@cybergah.com  ·  Web: cybergah.com  ·  Lisans: GPL-3.0  ·  © 2026 Cybergah Group",
     9,color=GREY,align=WD_ALIGN_PARAGRAPH.CENTER)

d.save(OUT)
print("wrote",OUT)
