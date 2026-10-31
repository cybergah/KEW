# Kew — Word article in Kurmancî (Kurdish) for the website. Cybergah Group.
import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
SHOTS=os.path.join(ROOT,"assets","shots","ku"); LOGO=os.path.join(ROOT,"src","assets","logo.png")
OUT=os.path.join(ROOT,"Kullanim-Kilavuzu","Kew-Tanitim-Haber-ku.docx")

GOLD=RGBColor(0x9a,0x7d,0x2e); GREEN=RGBColor(0x16,0x3a,0x25); GREY=RGBColor(0x55,0x60,0x58)
d=Document(); st=d.styles["Normal"]; st.font.name="Calibri"; st.font.size=Pt(11)

def h(t,size,color=None,align=None,space=6):
    p=d.add_paragraph(); r=p.add_run(t); r.bold=True; r.font.size=Pt(size)
    if color is not None: r.font.color.rgb=color
    if align is not None: p.alignment=align
    p.paragraph_format.space_after=Pt(space); return p
def para(t,size=11,italic=False,color=None,align=None,space=8):
    p=d.add_paragraph(); r=p.add_run(t); r.italic=italic; r.font.size=Pt(size)
    if color is not None: r.font.color.rgb=color
    if align is not None: p.alignment=align
    p.paragraph_format.space_after=Pt(space); return p
def img(path,width=2.6,cap=None):
    p=d.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.add_run().add_picture(path,width=Inches(width))
    if cap: para(cap,9,italic=True,color=GREY,align=WD_ALIGN_PARAGRAPH.CENTER,space=10)

pic=d.add_paragraph(); pic.alignment=WD_ALIGN_PARAGRAPH.CENTER; pic.add_run().add_picture(LOGO,width=Inches(1.3))
h("KEW",30,GOLD,align=WD_ALIGN_PARAGRAPH.CENTER,space=2)
para("Daxistina Vîdyoyan a Anonîm û Belaş",14,italic=True,color=GREEN,align=WD_ALIGN_PARAGRAPH.CENTER,space=2)
para("Cybergah Group  ·  cybergah.com  ·  Çavkanî Vekirî (GPL-3.0)",10,color=GREY,align=WD_ALIGN_PARAGRAPH.CENTER,space=14)

para("Cybergah Group, bi prensîba nepenîtî û gihîştina azad a li ser înternetê, sepana xwe ya nû ya mobîl "
     "Kew belav kir. Kew, ku bi kurmancî navê teyrê çiya (keklîk) e; ji YouTube, X (Twitter), TikTok û "
     "Instagramê daxistina vîdyoyan bi yek lînkê, bê vekirina hesêb û bê hiştina şopê pêkan dike. Sepan bi "
     "temamî belaş û çavkanî-vekirî ye.",12)

h("Armanc: Gihîştina Azad û Anonîm",16,GREEN)
para("Xala destpêkê ya Kew baweriyek hêsan e: gihîştina agahî û naverokê divê azad û anonîm be. Sepan tu "
     "daneyên kesane berhev nake, hesab naxwaze, reklam nîşan nade û bikarhêner naşopîne. Hemû naveroka "
     "daxistî tenê li ser cîhaza bikarhêner dimîne. Pêvajoya veqetandina vîdyoyê bê şandina daneyan bo "
     "pêşkêşkarekê, rasterast li hundirê telefonê bi motora çavkanî-vekirî ya yt-dlp tê kirin; bi vî awayî "
     "girêdayîbûna tu xizmeta aliyê sêyemîn û metirsiya derketina daneyan çênabe.")
img(os.path.join(SHOTS,"home.png"),cap="Ekrana sereke: lînkê têxe, platform bixweber tê nasîn, bi pêşdîtinê daxe.")

h("Taybetmendiyên Sereke",16,GREEN)
for b in [
 "Çar platform: YouTube, X, TikTok û Instagram — lînkê têxe, daxe.",
 "Lîsteyên YouTube (playlist): her vîdyo serbixwe tê daxistin; hemû bi yek bişkokê têne rawestandin an betalkirin.",
 "Daxistina vîdyo an tenê deng (MP3); hilbijartina kalîteyê (Max/1080/720/480).",
 "Daxistî rasterast li peldanka Daxistin/Kew têne tomarkirin; bi lîstikvanê hundirîn têne temaşekirin.",
 "Daxistina paşperdeyê: tewra dema sepan girtî be jî berdewam dike, dema xilas dibe bi dengê keklîkê agahdar dike.",
 "Pênc ziman: kurdî, tirkî, erebî, îngilîzî û farisî (ji bo erebî/farisî navrûya rast-bi-çep).",
 "Ceribandina otomatîk a ji nû ve: vîdyoya ku danabe nayê derbaskirin, ji nû ve tê ceribandin.",
]:
    p=d.add_paragraph(style="List Bullet"); p.add_run(b).font.size=Pt(11)
d.add_paragraph()
img(os.path.join(SHOTS,"downloads.png"),cap="Daxistin: koma lîsteyê, pêşveçûn, rawestandin/betalkirin û rewş.")

h("Çawa Dixebite?",16,GREEN)
para("Kew navrûyek React a nûjen bi Capacitorê li ser Androidê dipêçe. Karê veqetandin û daxistinê motora "
     "çavkanî-vekirî ya yt-dlp — ku li seranserê cîhanê piştgiriya zêdetirî 1000 malperan dike — li ser "
     "cîhazê dimeşîne û xwe nû dike. Bi vî awayî tewra malper biguherin jî sepan dixebite û hewceyî tu "
     "pêşkêşkarê navîn nake.")

h("Pir-zimanî û Gihîştinbar",16,GREEN)
para("Navrû bi pênc zimanan tê pêşkêşkirin û tavilê tê guhertin. Ji bo erebî û farisî piştgiriya tam a "
     "rast-bi-çep (RTL) heye. Sêwirandin nasnameyek kesk-zêr a ku ji keklîka çiyayan a azad îlham digire "
     "hildigire.")
img(os.path.join(SHOTS,"settings.png"),cap="Mîheng: hilbijartina ziman, agahdarî û dengê keklîkê, manîfestoya nepenîtiyê.")

h("Nepenîtî û Azadî",16,GREEN)
para("Kew bi lîsansa GPL-3.0 wek çavkanî-vekirî tê belavkirin; koda wê ji her kesî re vekirî ye, tê vekolîn "
     "û baştirkirin. Cybergah Group, bi dîtina înternetek azad û anonîm, bê armanca qezencê vê amûrê "
     "pêşkêşî civakê dike.")
para("“Gihîştina agahî divê azad û anonîm be.” — Cybergah Group", italic=True, color=GOLD)

d.add_paragraph()
para("Têkilî: info@cybergah.com  ·  Web: cybergah.com  ·  Lîsans: GPL-3.0  ·  © 2026 Cybergah Group",
     9,color=GREY,align=WD_ALIGN_PARAGRAPH.CENTER)

d.save(OUT); print("wrote",OUT)
