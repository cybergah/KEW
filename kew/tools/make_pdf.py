# Kew — professional A4 PDF user guide (light theme), 5 languages.
# Builds print-optimized HTML then (via Edge) prints to PDF. Cybergah Group.
import os, shutil
import make_guide as G  # reuse SEC, UI, LABEL, LANGS, RTL

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
SHOTS=os.path.join(ROOT,"assets","shots"); GUIDE=os.path.join(ROOT,"Kullanim-Kilavuzu")
PDIR=os.path.join(GUIDE,"print"); os.makedirs(PDIR,exist_ok=True)

GTITLE={"tr":"Kullanım Kılavuzu","en":"User Guide","ku":"Rêbera Bikaranînê","ar":"دليل الاستخدام","fa":"راهنمای استفاده"}
FEAT_H={"tr":"Öne Çıkanlar","en":"Highlights","ku":"Taybetmendî","ar":"أبرز المزايا","fa":"ویژگی‌ها"}
FEATS={
 "tr":[("📥","Linki yapıştır, indir — YouTube, X, TikTok, Instagram"),("🎬","Oynatma listesini tek tek indir, toplu kontrol et"),("🎵","Video ya da sadece ses (MP3), kalite seçimi"),("💾","Doğrudan İndirilenler/Kew klasörüne kaydeder"),("🔔","Arka planda indirir, bitince keklik sesiyle haber verir"),("🌍","5 dil: Kürtçe, Türkçe, Arapça, İngilizce, Farsça")],
 "en":[("📥","Paste a link & download — YouTube, X, TikTok, Instagram"),("🎬","Download playlists item-by-item with batch control"),("🎵","Video or audio-only (MP3) with quality choice"),("💾","Saved straight to the Downloads/Kew folder"),("🔔","Downloads in the background, notifies you when done"),("🌍","5 languages: Kurdish, Turkish, Arabic, English, Persian")],
 "ku":[("📥","Linkê têxe û daxe — YouTube, X, TikTok, Instagram"),("🎬","Lîsteyê yek bi yek daxe, bi giştî kontrol bike"),("🎵","Vîdyo an tenê deng (MP3), hilbijartina kalîteyê"),("💾","Rasterast li peldanka Daxistin/Kew tomar dike"),("🔔","Li paşperdeyê daxe, dema xilas bû agahdar dike"),("🌍","5 ziman: Kurdî, Tirkî, Erebî, Îngilîzî, Farisî")],
 "ar":[("📥","الصق الرابط ونزّل — يوتيوب، إكس، تيك توك، إنستغرام"),("🎬","نزّل قوائم التشغيل عنصرًا تلو الآخر مع تحكّم جماعي"),("🎵","فيديو أو صوت فقط (MP3) مع اختيار الجودة"),("💾","يُحفظ مباشرة في مجلد التنزيلات/Kew"),("🔔","ينزّل في الخلفية ويُعلمك عند الانتهاء"),("🌍","٥ لغات: الكردية، التركية، العربية، الإنجليزية، الفارسية")],
 "fa":[("📥","لینک را بچسبانید و دانلود کنید — یوتیوب، X، تیک‌تاک، اینستاگرام"),("🎬","لیست‌ها را تک‌تک دانلود کنید با کنترل گروهی"),("🎵","ویدیو یا فقط صدا (MP3) با انتخاب کیفیت"),("💾","مستقیم در پوشهٔ دانلودها/Kew ذخیره می‌شود"),("🔔","در پس‌زمینه دانلود می‌کند و اطلاع می‌دهد"),("🌍","۵ زبان: کردی، ترکی، عربی، انگلیسی، فارسی")],
}

CSS="""
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:15mm}
@page cover{margin:0}
body{font-family:"Segoe UI","Noto Sans Arabic",Tahoma,sans-serif;color:#23302a;background:#fff;font-size:11pt;line-height:1.55}
/* cover */
.cover{page:cover;width:210mm;height:297mm;position:relative;break-after:page;background:radial-gradient(120mm 90mm at 70% 12%,#1d4029,#0c1c12);color:#f1e8cf;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.cover .band{position:absolute;top:0;left:0;right:0;height:8mm;background:linear-gradient(90deg,#caa64a,#8d6f28)}
.cover .band.b{top:auto;bottom:0}
.cover img{width:54mm;height:54mm;filter:drop-shadow(0 6mm 12mm rgba(0,0,0,.4))}
.cover h1{font-size:54pt;letter-spacing:6px;margin:6mm 0 0;color:#e3c878}
.cover .tg{color:#cfe0d2;font-size:14pt;margin-top:2mm}
.cover .gt{font-size:26pt;color:#fff;margin-top:16mm;font-weight:700}
.cover .rule{width:40mm;height:2px;background:#caa64a;margin:6mm 0}
.cover .meta{position:absolute;bottom:16mm;color:#cdbf93;font-size:10pt;line-height:1.9}
.cover .meta b{color:#e3c878}
/* content */
.lead{display:flex;gap:8mm;align-items:center;border:1px solid #e7e2d2;background:#faf8f1;border-radius:5mm;padding:7mm;margin-bottom:8mm}
.lead img{width:24mm;height:24mm;flex:none}
.lead h2{color:#15633a;font-size:17pt;margin-bottom:2mm}
.lead p{color:#3a4a40}
h3.sec{font-size:12pt;color:#0e7a44;margin:0 0 4mm}
.featgrid{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-bottom:9mm}
.feat{border:1px solid #ece7d8;border-left:3px solid #caa64a;border-radius:3mm;padding:4mm 5mm;background:#fffdf8;display:flex;gap:4mm;align-items:flex-start}
.feat .i{font-size:15pt;line-height:1}
.feat .t{font-size:10.5pt;color:#2a3a30}
.step{display:flex;gap:8mm;align-items:center;padding:6mm 0;border-top:1px solid #eee7d6;break-inside:avoid}
.step:nth-child(even){flex-direction:row-reverse}
.shot{flex:none;width:42mm}
.frame{border:1.5mm solid #1b2c20;border-radius:6mm;overflow:hidden;box-shadow:0 4mm 9mm rgba(20,40,25,.25)}
.frame img{width:100%;display:block}
.body{flex:1}
.num{display:inline-flex;width:9mm;height:9mm;border-radius:50%;background:#15633a;color:#fff;align-items:center;justify-content:center;font-weight:700;font-size:12pt;margin-right:3mm;vertical-align:middle}
.body h2{display:inline;font-size:15pt;color:#15633a;vertical-align:middle}
.body p{margin-top:3mm;color:#34433a;font-size:11pt}
.mani{margin-top:9mm;background:linear-gradient(120deg,#15331f,#0e2417);color:#f1e8cf;border-radius:5mm;padding:7mm 8mm;border-left:4mm solid #caa64a}
.mani h3{color:#e3c878;font-size:14pt;margin-bottom:3mm}
.foot{margin-top:8mm;text-align:center;color:#7a857d;font-size:9.5pt;border-top:1px solid #e7e2d2;padding-top:5mm}
.foot b{color:#9a7d2e}
[dir=rtl] .num{margin-right:0;margin-left:3mm}
[dir=rtl] .feat{border-left:none;border-right:3px solid #caa64a}
[dir=rtl] .mani{border-left:none;border-right:4mm solid #caa64a}
"""

def build():
    # copy shots into print/img
    img=os.path.join(PDIR,"img");
    if os.path.exists(img): shutil.rmtree(img)
    os.makedirs(img)
    shutil.copy(os.path.join(ROOT,"src","assets","logo.png"),os.path.join(img,"logo.png"))
    for lang in G.LANGS:
        d=os.path.join(img,lang); os.makedirs(d)
        for f in os.listdir(os.path.join(SHOTS,lang)): shutil.copy(os.path.join(SHOTS,lang,f),os.path.join(d,f))
    for lang in G.LANGS:
        rtl=lang in G.RTL; u=G.UI[lang]
        intro=G.SEC[0]; steps=[s for s in G.SEC if s[0] in ("home","downloads","player","settings")]
        feats="".join(f'<div class="feat"><span class="i">{ic}</span><span class="t">{tx}</span></div>' for ic,tx in FEATS[lang])
        stepshtml=""
        for n,(img_name,tt,bb) in enumerate(steps,1):
            stepshtml+=f'''<section class="step"><div class="shot"><div class="frame"><img src="img/{lang}/{img_name}.png"></div></div>
<div class="body"><span class="num">{n}</span><h2>{tt[lang]}</h2><p>{bb[lang]}</p></div></section>'''
        man=[s for s in G.SEC]  # manifesto from intro body's spirit; use a fixed line
        html=f'''<!doctype html><html lang="{lang}" dir="{"rtl" if rtl else "ltr"}"><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<section class="cover"><div class="band"></div>
<img src="img/logo.png"><h1>KEW</h1><div class="tg">{u["sub"]}</div>
<div class="rule"></div><div class="gt">{GTITLE[lang]}</div>
<div class="meta"><b>Cybergah Group</b> · cybergah.com<br>{u["by"]}<br>v1.0.0 · GPL-3.0 · © 2026</div>
<div class="band b"></div></section>
<main class="content">
<div class="lead"><img src="img/logo.png"><div><h2>{intro[1][lang]}</h2><p>{intro[2][lang]}</p></div></div>
<h3 class="sec">★ {FEAT_H[lang]}</h3>
<div class="featgrid">{feats}</div>
{stepshtml}
<div class="mani"><h3>⚑ {("Anonimlik & Özgürlük" if lang=="tr" else "Anonymity & Freedom" if lang=="en" else "Anonimî & Azadî" if lang=="ku" else "الخصوصية والحرية" if lang=="ar" else "ناشناسی و آزادی")}</h3>
<p>{intro[2][lang]}</p></div>
<div class="foot"><b>Cybergah Group</b> · cybergah.com · info@cybergah.com — Kew v1.0.0 · GPL-3.0</div>
</main></body></html>'''
        with open(os.path.join(PDIR,f"print-{lang}.html"),"w",encoding="utf-8") as f: f.write(html)
    print("print HTML written to",PDIR)

if __name__=="__main__": build()
