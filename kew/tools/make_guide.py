# Kew — visual user guide generator (5 languages, with screenshots).
# Cybergah Group. Outputs a portable folder of HTML guides.
import os, shutil

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
SHOTS=os.path.join(ROOT,"assets","shots")
OUTDIR=os.path.join(ROOT,"Kullanim-Kilavuzu")
LANGS=["tr","en","ku","ar","fa"]; RTL={"ar","fa"}
LABEL={"tr":"Türkçe","en":"English","ku":"Kurdî","ar":"العربية","fa":"فارسی"}

UI={
 "tr":dict(title="Kew — Kullanım Kılavuzu",sub="Anonim ve ücretsiz video indirici",by="Cybergah Group tarafından",steps="Adımlar",other="Diğer diller"),
 "en":dict(title="Kew — User Guide",sub="Anonymous & free video downloader",by="By Cybergah Group",steps="Steps",other="Other languages"),
 "ku":dict(title="Kew — Rêbera Bikaranînê",sub="Daxistina vîdyoyan a anonîm û belaş",by="Ji aliyê Cybergah Group ve",steps="Gav",other="Zimanên din"),
 "ar":dict(title="Kew — دليل الاستخدام",sub="منزّل فيديو مجهول ومجاني",by="من إنتاج Cybergah Group",steps="الخطوات",other="لغات أخرى"),
 "fa":dict(title="Kew — راهنمای استفاده",sub="دانلودکنندهٔ ویدیوی ناشناس و رایگان",by="ساخت Cybergah Group",steps="مراحل",other="زبان‌های دیگر"),
}

# sections: (screen_image, title_per_lang, body_per_lang)
SEC=[
 ("intro",
  dict(tr="Kew nedir?",en="What is Kew?",ku="Kew çi ye?",ar="ما هو Kew؟",fa="Kew چیست؟"),
  dict(tr="Kew (Kürtçe ‘keklik’) YouTube, X, TikTok ve Instagram’dan video indiren açık kaynaklı, anonim ve tamamen ücretsiz bir uygulamadır. Hesap yok, takip yok, reklam yok. Çıkarma işlemi cihazınızda yt-dlp ile yapılır; hiçbir sunucuya bağımlı değildir.",
       en="Kew (‘partridge’ in Kurdish) downloads videos from YouTube, X, TikTok and Instagram. Open source, anonymous, fully free. No account, no tracking, no ads. Extraction runs on your device with yt-dlp — no server.",
       ku="Kew (bi kurdî ‘keklîk’) ji YouTube, X, TikTok û Instagramê vîdyoyan daxe. Çavkanî vekirî, anonîm û belaş. Bê hesab, bê şopandin, bê reklam.",
       ar="Kew (وتعني ‘الحجل’ بالكردية) ينزّل الفيديو من يوتيوب وإكس وتيك توك وإنستغرام. مفتوح المصدر ومجهول ومجاني تمامًا. بلا حساب ولا تتبّع ولا إعلانات. يتم الاستخراج على جهازك عبر yt-dlp بلا خادم.",
       fa="Kew (به کردی یعنی ‘کبک’) ویدیو را از یوتیوب، X، تیک‌تاک و اینستاگرام دانلود می‌کند. متن‌باز، ناشناس و کاملاً رایگان. بدون حساب، بدون ردیابی، بدون تبلیغ. استخراج روی دستگاه شما با yt-dlp انجام می‌شود.")),
 ("home",
  dict(tr="1) Linki yapıştır ve indir",en="1) Paste a link & download",ku="1) Linkê têxe û daxe",ar="١) الصق الرابط ونزّل",fa="۱) لینک را بچسبانید و دانلود کنید"),
  dict(tr="Videonun linkini kopyalayıp ‘Yapıştır’a dokunun. Kew platformu otomatik tanır ve videonun başlığı ile küçük resmini gösterir. ‘İndir’e basın. İstersen ‘Video/Ses’ ile MP3 indir, kaliteyi (Max/1080/720/480) seç. Dosyalar ‘İndirilenler/Kew’ klasörüne kaydedilir.",
       en="Copy the video link and tap ‘Paste’. Kew detects the platform and shows the title and thumbnail. Tap ‘Download’. Toggle ‘Video/Audio’ for MP3 and pick quality (Max/1080/720/480). Files are saved to ‘Downloads/Kew’.",
       ku="Linkê kopî bike û ‘Têxe’ bike. Kew platformê nas dike û sernav û wêneyê nîşan dide. ‘Daxe’ bike. Bi ‘Vîdyo/Deng’ MP3 daxe, kalîteyê hilbijêre.",
       ar="انسخ رابط الفيديو واضغط ‘لصق’. يتعرّف Kew على المنصة ويعرض العنوان والصورة المصغّرة. اضغط ‘تنزيل’. بدّل ‘فيديو/صوت’ لـ MP3 واختر الجودة. تُحفظ الملفات في ‘التنزيلات/Kew’.",
       fa="لینک ویدیو را کپی کنید و ‘چسباندن’ را بزنید. Kew پلتفرم را تشخیص می‌دهد و عنوان و تصویر را نشان می‌دهد. ‘دانلود’ را بزنید. با ‘ویدیو/صدا’ به MP3 تغییر دهید و کیفیت را انتخاب کنید. فایل‌ها در ‘دانلودها/Kew’ ذخیره می‌شوند.")),
 ("downloads",
  dict(tr="2) İndirilenler ve playlist",en="2) Downloads & playlists",ku="2) Daxistin û lîste",ar="٢) التنزيلات وقوائم التشغيل",fa="۲) دانلودها و لیست‌ها"),
  dict(tr="Her indirme burada görünür. YouTube playlist’i yapıştırınca her video ayrı bir kart olur ve tek tek, biten anında kaydedilir. Üstteki playlist başlığından tüm listeyi birden ⏸ duraklat / ▶ devam / ✕ iptal edebilirsin. Tek bir video inmezse otomatik 3 kez tekrar denenir; olmazsa kırmızı hata satırı gösterilir ve ↻ ile yeniden denenir.",
       en="Every download appears here. Paste a YouTube playlist and each video becomes its own card, saved as soon as it finishes. Use the playlist header to ⏸ pause / ▶ resume / ✕ cancel the whole list at once. A failing video auto-retries 3×; otherwise a red error line shows and you can retry with ↻.",
       ku="Her daxistin li vir xuya dibe. Lîsteyê têxe, her vîdyo dibe kartek û tê tomarkirin. Ji sernavê lîsteyê hemûyan bi hev ⏸/▶/✕ bike.",
       ar="يظهر كل تنزيل هنا. الصق قائمة تشغيل يوتيوب فيصبح كل فيديو بطاقة منفصلة تُحفظ فور انتهائها. استخدم رأس القائمة لإيقاف/استئناف/إلغاء القائمة كاملة. الفيديو الفاشل يُعاد تلقائيًا ٣ مرات.",
       fa="هر دانلود اینجا نمایش داده می‌شود. لیست یوتیوب را بچسبانید تا هر ویدیو کارت جداگانه شود و به‌محض پایان ذخیره گردد. از سربرگ لیست کل آن را ⏸/▶/✕ کنید. ویدیوی ناموفق ۳ بار خودکار تلاش می‌شود.")),
 ("player",
  dict(tr="3) Oynatıcı",en="3) Player",ku="3) Lîstik",ar="٣) المشغّل",fa="۳) پخش‌کننده"),
  dict(tr="İndirilen videoyu ▶ ile uygulama içinde oynat ya da ⤓ ile sistem oynatıcısında aç. Ses indirmeleri MP3 olarak saklanır.",
       en="Play a downloaded video with ▶ inside the app, or open it in the system player with ⤓. Audio downloads are kept as MP3.",
       ku="Vîdyoya daxistî bi ▶ di nav sepanê de bilîze an bi ⤓ di lîstikvanê pergalê de veke.",
       ar="شغّل الفيديو المُنزَّل بـ ▶ داخل التطبيق أو افتحه في مشغّل النظام بـ ⤓. تُحفظ تنزيلات الصوت بصيغة MP3.",
       fa="ویدیوی دانلودشده را با ▶ داخل برنامه پخش کنید یا با ⤓ در پخش‌کنندهٔ سیستم باز کنید.")),
 ("settings",
  dict(tr="4) Ayarlar, dil ve bildirimler",en="4) Settings, language & notifications",ku="4) Mîheng, ziman û agahdarî",ar="٤) الإعدادات واللغة والإشعارات",fa="۴) تنظیمات، زبان و اعلان‌ها"),
  dict(tr="Sağ üstteki 🌐 ile dili anında değiştir (Kürtçe, Türkçe, Arapça, İngilizce, Farsça — Arapça ve Farsça sağdan-sola). Ayarlar’dan 🔔 bildirimleri ve 🐦 keklik sesini aç/kapat. İndirme bittiğinde keklik sesiyle bildirim gelir; arka planda da indirme sürer.",
       en="Switch language instantly with 🌐 (Kurdish, Turkish, Arabic, English, Persian — Arabic & Persian are right-to-left). In Settings toggle 🔔 notifications and the 🐦 keklik sound. When a download finishes you get a notification with the keklik call; downloads continue in the background.",
       ku="Bi 🌐 zimanî biguhere. Ji Mîhengan 🔔 agahdarî û 🐦 dengê keklîkê veke/bigire. Dema daxistin xilas dibe deng tê.",
       ar="بدّل اللغة فورًا بـ 🌐 (الكردية، التركية، العربية، الإنجليزية، الفارسية — العربية والفارسية من اليمين لليسار). من الإعدادات فعّل 🔔 الإشعارات و🐦 صوت الحجل. تستمر التنزيلات في الخلفية.",
       fa="با 🌐 زبان را فوری عوض کنید (کردی، ترکی، عربی، انگلیسی، فارسی — عربی و فارسی راست‌به‌چپ). در تنظیمات 🔔 اعلان‌ها و 🐦 صدای کبک را روشن/خاموش کنید. دانلودها در پس‌زمینه ادامه می‌یابند.")),
]

CSS="""
:root{--bg:#0b1610;--bg2:#0f1f15;--card:#152a1b;--line:#2c4031;--gold:#caa64a;--golds:#e3c878;--cream:#f1e8cf;--text:#eef3ec;--muted:#9fb0a3}
*{box-sizing:border-box}
body{margin:0;font-family:"Segoe UI",Vazirmatn,system-ui,"Noto Sans Arabic",Tahoma,sans-serif;color:var(--text);
background:radial-gradient(1000px 600px at 80% -10%,#1c3a25,transparent 55%),linear-gradient(180deg,#0d1b13,#07120b);min-height:100vh}
.wrap{max-width:1000px;margin:0 auto;padding:28px 18px 80px}
header.hero{text-align:center;padding:30px 10px 8px}
header.hero img{width:96px;height:96px;filter:drop-shadow(0 8px 20px rgba(202,166,74,.35))}
h1{font-size:30px;margin:14px 0 4px;background:linear-gradient(90deg,var(--golds),var(--cream));-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:var(--muted);margin:0}
.by{color:var(--golds);font-size:13px;margin-top:6px}
.langbar{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:18px 0 6px}
.langbar a{color:var(--text);text-decoration:none;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:7px 14px;font-size:14px}
.langbar a.on{border-color:var(--gold);color:var(--golds)}
.sec{display:flex;gap:22px;align-items:center;background:rgba(21,42,27,.6);border:1px solid var(--line);border-radius:20px;padding:20px;margin:18px 0;backdrop-filter:blur(8px)}
.sec:nth-child(even){flex-direction:row-reverse}
.shot{flex:0 0 250px;display:flex;justify-content:center}
.phone{width:240px;border:8px solid #1b2c20;border-radius:34px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.5);background:#000}
.phone img{width:100%;display:block}
.txt{flex:1;min-width:240px}
.txt h2{margin:0 0 10px;font-size:21px;color:var(--golds)}
.txt p{margin:0;line-height:1.75;color:var(--text);font-size:15px}
footer{text-align:center;color:var(--muted);font-size:13px;margin-top:30px;line-height:1.9}
footer a{color:var(--golds);text-decoration:none}
.badge{display:inline-block;border:1px solid var(--gold);color:var(--golds);border-radius:999px;padding:4px 12px;font-size:12px;margin-top:8px}
[dir=rtl] .sec{direction:rtl}
@media(max-width:680px){.sec{flex-direction:column!important;text-align:center}.txt{min-width:0}}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:12mm}
@media print{.langbar{display:none}.sec{break-inside:avoid;page-break-inside:avoid}header.hero{break-after:avoid}}
"""

def build():
    if os.path.exists(OUTDIR): shutil.rmtree(OUTDIR)
    os.makedirs(OUTDIR)
    # copy screenshots + logo
    os.makedirs(os.path.join(OUTDIR,"img"),exist_ok=True)
    shutil.copy(os.path.join(ROOT,"src","assets","logo.png"),os.path.join(OUTDIR,"img","logo.png"))
    for lang in LANGS:
        dst=os.path.join(OUTDIR,"img",lang); os.makedirs(dst,exist_ok=True)
        for f in os.listdir(os.path.join(SHOTS,lang)):
            shutil.copy(os.path.join(SHOTS,lang,f),os.path.join(dst,f))
    for lang in LANGS:
        rtl=lang in RTL; u=UI[lang]
        langbar="".join(f'<a class="{"on" if l==lang else ""}" href="kew-kilavuz-{l}.html">{LABEL[l]}</a>' for l in LANGS)
        secs=""
        for img,tt,bb in SEC:
            secs+=f'''<div class="sec"><div class="shot"><div class="phone"><img src="img/{lang}/{img}.png" alt=""></div></div>
<div class="txt"><h2>{tt[lang]}</h2><p>{bb[lang]}</p></div></div>'''
        html=f'''<!doctype html><html lang="{lang}" dir="{"rtl" if rtl else "ltr"}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{u["title"]}</title><style>{CSS}</style></head>
<body><div class="wrap">
<header class="hero"><img src="img/logo.png" alt="Kew">
<h1>{u["title"]}</h1><p class="sub">{u["sub"]}</p><div class="by">{u["by"]}</div>
<span class="badge">⚑ GPL-3.0 · cybergah.com</span></header>
<div class="langbar">{langbar}</div>
{secs}
<footer><strong>Cybergah Group</strong> · <a href="https://cybergah.com">cybergah.com</a> · info@cybergah.com<br>
Kew v1.0.0 · Açık kaynak / Open source · GPL-3.0 · © 2026</footer>
</div></body></html>'''
        with open(os.path.join(OUTDIR,f"kew-kilavuz-{lang}.html"),"w",encoding="utf-8") as f: f.write(html)
    # index redirect (Turkish default)
    with open(os.path.join(OUTDIR,"index.html"),"w",encoding="utf-8") as f:
        f.write('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=kew-kilavuz-tr.html">')
    print("guide written to",OUTDIR)

if __name__=="__main__": build()
