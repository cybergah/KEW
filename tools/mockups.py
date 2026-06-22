# Kew — screenshot/mockup generator. Cybergah Group.
# Phone-framed screenshots per language, matching the real app. Feeds the
# user guide, the Word article and the promo video.
import os, sys
from PIL import Image, ImageDraw, ImageFont
import arabic_reshaper
from bidi.algorithm import get_display

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
LOGO = os.path.join(ROOT, "src", "assets", "logo.png")
OUT = os.path.join(ROOT, "assets", "shots")
SS = 2
F = "C:/Windows/Fonts/"

BG_TOP=(24,52,33); BG_BOT=(7,18,11); CARD=(22,42,28); LINE=(52,70,58)
GOLD=(202,166,74); GOLDS=(227,200,120); CREAM=(241,232,207); RED=(212,50,42)
MUTED=(147,165,150); TEXT=(238,243,236); OK=(79,209,139); BG2=(18,36,24)
RTL={"ar","fa"}; LANGS=["tr","en","ku","ar","fa"]

EX_TITLE="Belgesel: Dag Keklikleri"; EX_UP="Cybergah TV"; PL_TITLE="Kurtce Muzik 2026"
ITEMS=["Dengbej - Lawik","Sirin Govend","Halay 2026"]

L={
 "tr":dict(tag="Video indirici — anonim ve ucretsiz",paste="Linki buraya yapistir",pst="Yapistir",detected="algilandi",playlist="Liste",video="Video",audio="Ses",dl="Indir",save="Konum: Indirilenler/Kew",home="Ana Sayfa",downloads="Indirilenler",player="Oynatici",about="Hakkinda",completed="Tamamlandi",downloading="Indiriliyor",paused="Duraklatildi",queued="Sirada",settings="Ayarlar",notif="Bildirimler",sound="Keklik sesi",lang="Dil",engine="Cikarma cihazinda yt-dlp ile",manT="Anonimlik & Ozgurluk",manB="Bilgiye erisim ozgur ve anonim olmali. Kew veri toplamaz, seni izlemez, her zaman ucretsiz.",foss="Acik kaynak - GPL-3.0",openw="Ac"),
 "en":dict(tag="Video downloader — anonymous & free",paste="Paste a link here",pst="Paste",detected="detected",playlist="Playlist",video="Video",audio="Audio",dl="Download",save="Location: Downloads/Kew",home="Home",downloads="Downloads",player="Player",about="About",completed="Completed",downloading="Downloading",paused="Paused",queued="Queued",settings="Settings",notif="Notifications",sound="Keklik sound",lang="Language",engine="On-device extraction via yt-dlp",manT="Anonymity & Freedom",manB="Access to information must be free and anonymous. Kew collects no data, never tracks you, always free.",foss="Open source - GPL-3.0",openw="Open"),
 "ku":dict(tag="Daxistina vidyoyan — anonim u belas",paste="Linke li vir deyne",pst="Texe",detected="hat ditin",playlist="Liste",video="Vidyo",audio="Deng",dl="Daxe",save="Cih: Daxistin/Kew",home="Mal",downloads="Daxistin",player="Listik",about="Derbar",completed="Qediya",downloading="Te daxistin",paused="Rawestiya",queued="Di reze de",settings="Miheng",notif="Agahdari",sound="Denge keklike",lang="Ziman",engine="Veqetandin li ser cihaze bi yt-dlp",manT="Anonimi & Azadi",manB="Gihistina agahi divet azad u anonim be. Kew dane berhev nake, te nasekinine, her dem belas e.",foss="Cavkani vekiri - GPL-3.0",openw="Veke"),
 "ar":dict(tag="تنزيل الفيديو — مجهول ومجاني",paste="الصق الرابط هنا",pst="لصق",detected="تم الكشف",playlist="قائمة",video="فيديو",audio="صوت",dl="تنزيل",save="المكان: التنزيلات/Kew",home="الرئيسية",downloads="التنزيلات",player="المشغل",about="حول",completed="اكتمل",downloading="جار التنزيل",paused="متوقف",queued="في الانتظار",settings="الاعدادات",notif="الاشعارات",sound="صوت الحجل",lang="اللغة",engine="الاستخراج على جهازك عبر yt-dlp",manT="الخصوصية والحرية",manB="يجب ان يكون الوصول للمعلومات حرا ومجهولا. لا يجمع Kew بيانات ولا يتعقبك وهو مجاني دائما.",foss="مفتوح المصدر - GPL-3.0",openw="فتح"),
 "fa":dict(tag="دانلود ویدیو — ناشناس و رایگان",paste="لینک را اینجا بچسبانید",pst="چسباندن",detected="شناسایی شد",playlist="لیست",video="ویدیو",audio="صدا",dl="دانلود",save="مکان: دانلودها/Kew",home="خانه",downloads="دانلودها",player="پخش",about="درباره",completed="تکمیل شد",downloading="در حال دانلود",paused="متوقف",queued="در صف",settings="تنظیمات",notif="اعلان ها",sound="صدای کبک",lang="زبان",engine="استخراج روی دستگاه با yt-dlp",manT="ناشناسی و آزادی",manB="دسترسی به اطلاعات باید آزاد و ناشناس باشد. Kew داده جمع نمیکند، شما را ردیابی نمیکند، همیشه رایگان است.",foss="متن باز - GPL-3.0",openw="باز"),
}

def sx(v): return int(v*SS)
def shp(t,lang): return get_display(arabic_reshaper.reshape(t)) if lang in RTL else t
_fc={}
def fnt(n,s):
    k=(n,int(s*SS));
    if k not in _fc: _fc[k]=ImageFont.truetype(F+n,int(s*SS))
    return _fc[k]
def REG(s): return fnt("segoeui.ttf",s)
def SB(s): return fnt("seguisb.ttf",s)
def BD(s): return fnt("segoeuib.ttf",s)
def SY(s): return fnt("seguisym.ttf",s)
def EM(s): return fnt("seguiemj.ttf",s)

class C:
    def __init__(s,w,h): s.W,s.H=w,h; s.img=Image.new("RGB",(sx(w),sx(h)),BG_BOT); s.d=ImageDraw.Draw(s.img)
    def grad(s):
        for y in range(sx(s.H)):
            g=max(0.0,1-(y/sx(s.H)/0.62)); c=tuple(int(BG_BOT[i]+(BG_TOP[i]-BG_BOT[i])*g) for i in range(3))
            s.d.line([(0,y),(sx(s.W),y)],fill=c)
    def rr(s,box,r,fill=None,outline=None,width=1):
        s.d.rounded_rectangle([sx(box[0]),sx(box[1]),sx(box[2]),sx(box[3])],radius=sx(r),fill=fill,outline=outline,width=sx(width))
    def t(s,xy,txt,font,fill=TEXT,lang="en",anchor="la"):
        s.d.text((sx(xy[0]),sx(xy[1])),shp(txt,lang),font=font,fill=fill,anchor=anchor)
    def ic(s,xy,g,size,fill,anchor="lm"):
        s.d.text((sx(xy[0]),sx(xy[1])),g,font=SY(size),fill=fill,anchor=anchor)
    def emo(s,xy,g,size,anchor="lm"):
        s.d.text((sx(xy[0]),sx(xy[1])),g,font=EM(size),embedded_color=True,anchor=anchor)
    def tw(s,txt,font,lang="en"): return s.d.textlength(shp(txt,lang),font=font)/SS
    def iw(s,g,size): return s.d.textlength(g,font=SY(size))/SS
    def ell(s,box,**k): s.d.ellipse([sx(box[0]),sx(box[1]),sx(box[2]),sx(box[3])],**k)
    def ln(s,pts,**k): s.d.line([(sx(p[0]),sx(p[1])) for p in pts],**{**k,"width":sx(k.get("width",1))})
    def paste(s,im,xy): s.img.paste(im,(sx(xy[0]),sx(xy[1])),im)
    def out(s): return s.img.resize((s.W,s.H),Image.LANCZOS)
    # left icon + label
    def il(s,x,ymid,g,isize,text,tfont,icol,tcol,lang,gap=7):
        s.ic((x,ymid),g,isize,icol); w=s.iw(g,isize)
        s.d.text((sx(x+w+gap),sx(ymid)),shp(text,lang),font=tfont,fill=tcol,anchor="lm")
    # centered icon + label
    def ilc(s,cx,ymid,g,isize,text,tfont,icol,tcol,lang,gap=7):
        w=s.iw(g,isize); tw=s.tw(text,tfont,lang); st=cx-(w+gap+tw)/2
        s.ic((st,ymid),g,isize,icol); s.d.text((sx(st+w+gap),sx(ymid)),shp(text,lang),font=tfont,fill=tcol,anchor="lm")
    # centered emoji + label
    def emc(s,cx,ymid,g,esize,text,tfont,tcol,lang,gap=6):
        w=esize; tw=s.tw(text,tfont,lang); st=cx-(w+gap+tw)/2
        s.emo((st,ymid),g,esize); s.d.text((sx(st+w+gap),sx(ymid)),shp(text,lang),font=tfont,fill=tcol,anchor="lm")

_L=Image.open(LOGO).convert("RGBA") if os.path.exists(LOGO) else None
def logo(sz): return _L.resize((sz*SS,sz*SS),Image.LANCZOS) if _L else Image.new("RGBA",(sz*SS,sz*SS),(0,0,0,0))

def thumb(platform,w,h):
    cols={"YouTube":(255,0,51),"TikTok":(45,226,218),"Instagram":(225,48,108),"X":(220,220,225),"kew":(202,166,74)}
    im=Image.new("RGBA",(w*SS,h*SS),(0,0,0,0)); d=ImageDraw.Draw(im); c=cols.get(platform,(150,150,150))
    d.rounded_rectangle([0,0,w*SS-1,h*SS-1],radius=10*SS,fill=(12,20,15))
    g={"YouTube":"▶","TikTok":"♪","Instagram":"◎","X":"X","kew":"▶"}.get(platform,"▶")
    d.text((w*SS/2,h*SS/2),g,font=SY(min(w,h)*0.4),fill=c,anchor="mm")
    return im

W,H=400,820
def header(c,lang):
    c.paste(logo(40),(16,20)); c.d.text((sx(64),sx(20)),"KEW",font=BD(26),fill=GOLDS)
    c.t((64,54),L[lang]["tag"],REG(11),fill=MUTED,lang=lang)
    c.rr((W-110,22,W-16,50),14,fill=CARD,outline=LINE,width=1)
    c.emc((W-63),36,"\U0001F310",13,{"tr":"Turkce","en":"English","ku":"Kurdi","ar":"العربية","fa":"فارسی"}[lang],REG(11),TEXT,lang)

def tabbar(c,lang,active):
    y=H-64; c.rr((12,y,W-12,y+50),18,fill=(20,38,25),outline=LINE,width=1)
    tabs=[("⌂",L[lang]["home"]),("↓",L[lang]["downloads"]),("▶",L[lang]["player"]),("❖",L[lang]["about"])]
    seg=(W-24)/len(tabs)
    for i,(ic,lab) in enumerate(tabs):
        cx=12+seg*i+seg/2; col=GOLDS if i==active else MUTED
        c.ic((cx,y+16),ic,17,col,anchor="mm"); c.d.text((sx(cx),sx(y+30)),shp(lab,lang),font=REG(9),fill=col,anchor="ma")

def screen_home(lang):
    c=C(W,H); c.grad(); header(c,lang)
    c.paste(logo(78),(W//2-39,74))
    c.d.text((sx(W/2),sx(162)),shp(L[lang]["tag"],lang),font=BD(15),fill=TEXT,anchor="ma")
    c.d.text((sx(W/2),sx(186)),"YouTube   X   TikTok   Instagram",font=REG(11),fill=MUTED,anchor="ma")
    c.rr((16,212,W-16,432),18,fill=CARD,outline=LINE,width=1)
    c.rr((28,228,W-104,268),12,fill=BG2,outline=GOLD,width=1)
    c.t((42,248),L[lang]["paste"],REG(12),fill=MUTED,lang=lang,anchor="lm")
    c.rr((W-96,228,W-28,268),12,fill=BG2,outline=LINE,width=1); c.t((W-62,248),L[lang]["pst"],REG(12),fill=TEXT,lang=lang,anchor="mm")
    c.rr((28,282,120,308),9,fill=(178,0,36)); c.il(38,295,"▶",10,"YouTube",SB(11),(255,255,255),(255,255,255),"en")
    c.rr((128,282,214,308),13,fill=BG2,outline=GOLD,width=1); c.ilc(171,295,"✓",10,L[lang]["detected"],REG(10),GOLDS,GOLDS,lang)
    c.rr((28,318,W-28,390),12,fill=BG2,outline=LINE,width=1); c.paste(thumb("YouTube",98,58),(36,325))
    c.t((146,346),EX_TITLE,SB(13),fill=TEXT,lang=lang,anchor="lm"); c.t((146,366),EX_UP,REG(11),fill=MUTED,lang=lang,anchor="lm")
    c.rr((28,400,148,424),10,fill=BG2,outline=LINE,width=1); c.ilc(88,412,"▦",11,L[lang]["video"],REG(11),TEXT,TEXT,lang)
    for i,q in enumerate(["Max","1080p","720p"]):
        on=i==1; x=158+i*68; c.rr((x,400,x+62,424),10,fill=(52,44,20) if on else BG2,outline=GOLD if on else LINE,width=1)
        c.d.text((sx(x+31),sx(412)),q,font=REG(10),fill=GOLDS if on else MUTED,anchor="mm")
    c.rr((28,444,W-28,488),13,fill=GOLD); c.ilc(W/2,466,"↓",16,L[lang]["dl"],BD(15),(26,19,6),(26,19,6),lang)
    c.rr((16,502,W-16,540),12,fill=CARD,outline=LINE,width=1); c.emc(W/2,521,"\U0001F4C1",13,L[lang]["save"],REG(11),MUTED,lang)
    tabbar(c,lang,0); return c.out()

def dl_item(c,y,lang,platform,title,status,color,pct=None,btns=("play","open","del")):
    c.rr((22,y,W-22,y+64),16,fill=CARD,outline=LINE,width=1); c.paste(thumb(platform,50,50),(32,y+7))
    c.t((94,y+20),title,SB(12),fill=TEXT,lang=lang,anchor="lm")
    dot={"ok":OK,"gold":GOLD,"muted":MUTED}[color]; c.ell((94,y+36,102,y+44),fill=dot)
    sub=status+("  "+str(pct)+"%" if pct is not None else "")+"   "+platform
    c.t((110,y+40),sub,REG(10),fill=MUTED,lang=lang,anchor="lm")
    bx=W-34; icons={"play":"▶","open":"⤓","del":"✕","pause":"⏸","retry":"↻"}
    for b in reversed(btns):
        c.rr((bx-34,y+13,bx,y+47),10,fill=BG2,outline=LINE,width=1); c.ic((bx-17,y+30),icons[b],13,RED if b=="del" else TEXT,anchor="mm"); bx-=40
    if pct is not None:
        c.rr((34,y+54,W-34,y+58),2,fill=BG_BOT); c.rr((34,y+54,34+(W-68)*pct/100,y+58),2,fill=GOLD)

def screen_downloads(lang):
    c=C(W,H); c.grad(); header(c,lang); y=80
    c.rr((16,y,W-16,y+252),18,fill=(30,40,24),outline=GOLD,width=1)
    c.il(34,y+22,"≡",13,PL_TITLE,SB(13),GOLDS,TEXT,lang)
    c.t((34,y+40),"1/3   "+L[lang]["completed"],REG(10),fill=MUTED,lang=lang,anchor="lm")
    bx=W-34
    for b in ["pause","del"]:
        c.rr((bx-34,y+10,bx,y+44),10,fill=BG2,outline=LINE,width=1); c.ic((bx-17,y+27),{"pause":"⏸","del":"✕"}[b],13,RED if b=="del" else TEXT,anchor="mm"); bx-=40
    dl_item(c,y+54,lang,"YouTube",ITEMS[0],L[lang]["completed"],"ok",None,("play","open","del"))
    dl_item(c,y+126,lang,"YouTube",ITEMS[1],L[lang]["downloading"],"gold",64,("pause","del"))
    dl_item(c,y+186,lang,"YouTube",ITEMS[2],L[lang]["queued"],"muted",None,("del",))
    dl_item(c,y+272,lang,"TikTok","Dag Keklikleri",L[lang]["completed"],"ok",None,("play","open","del"))
    dl_item(c,y+344,lang,"Instagram","Reel - Cybergah",L[lang]["paused"],"gold",38,("retry","del"))
    tabbar(c,lang,1); return c.out()

def screen_player(lang):
    c=C(W,H); c.grad(); header(c,lang)
    c.rr((16,90,W-16,420),18,fill=CARD,outline=LINE,width=1)
    c.rr((28,102,W-28,300),12,fill=(0,0,0)); c.paste(thumb("kew",110,74),(W//2-55,150))
    c.d.ellipse([sx(W/2-26),sx(176),sx(W/2+26),sx(228)],outline=(255,255,255),width=sx(3))
    c.d.polygon([(sx(W/2-7),sx(190)),(sx(W/2-7),sx(214)),(sx(W/2+13),sx(202))],fill=(255,255,255))
    c.t((28,322),EX_TITLE,BD(14),fill=TEXT,lang=lang,anchor="lm"); c.t((28,344),"YouTube",REG(11),fill=MUTED,lang=lang,anchor="lm")
    c.rr((28,366,W-28,404),12,fill=BG2,outline=LINE,width=1); c.ilc(W/2,385,"⤓",13,L[lang]["openw"],REG(13),TEXT,TEXT,lang)
    tabbar(c,lang,2); return c.out()

def wrap(c,text,x,y,maxw,font,fill,lang,lh):
    words=text.split(" "); line=""; yy=y
    for w in words:
        test=(line+" "+w).strip()
        if c.tw(test,font,lang)>maxw and line:
            c.d.text((sx(x),sx(yy)),shp(line,lang),font=font,fill=fill); line=w; yy+=lh
        else: line=test
    if line: c.d.text((sx(x),sx(yy)),shp(line,lang),font=font,fill=fill)

def screen_settings(lang):
    c=C(W,H); c.grad(); header(c,lang); y=84
    c.rr((16,y,W-16,y+150),18,fill=CARD,outline=LINE,width=1); c.paste(logo(64),(W//2-32,y+12))
    c.d.text((sx(W/2),sx(y+84)),"Kew",font=BD(18),fill=TEXT,anchor="ma")
    c.ilc(W/2,y+112,"⚑",11,L[lang]["foss"],REG(11),GOLDS,GOLDS,lang)
    y2=y+162; c.rr((16,y2,W-16,y2+96),18,fill=CARD,outline=LINE,width=1); c.ln([(19,y2+12),(19,y2+84)],fill=GOLD,width=3)
    c.il(34,y2+22,"⚑",13,L[lang]["manT"],BD(13),GOLDS,GOLDS,lang); wrap(c,L[lang]["manB"],34,y2+40,W-56,REG(11),MUTED,lang,16)
    y3=y2+108; c.rr((16,y3,W-16,y3+204),18,fill=CARD,outline=LINE,width=1)
    c.il(30,y3+22,"⚙",14,L[lang]["settings"],BD(14),TEXT,TEXT,lang)
    c.t((30,y3+46),L[lang]["engine"],REG(10),fill=MUTED,lang=lang,anchor="lm")
    c.rr((30,y3+62,W//2-4,y3+94),11,fill=(52,44,20),outline=GOLD,width=1); c.emc((30+W//2-4)/2,y3+78,"\U0001F514",11,L[lang]["notif"],REG(10),GOLDS,lang)
    c.rr((W//2+4,y3+62,W-30,y3+94),11,fill=(52,44,20),outline=GOLD,width=1); c.emc((W//2+4+W-30)/2,y3+78,"\U0001F426",11,L[lang]["sound"],REG(10),GOLDS,lang)
    c.t((30,y3+112),L[lang]["lang"],REG(11),fill=MUTED,lang=lang,anchor="lm")
    grid=[("Kurdi",lang=="ku"),("Turkce",lang=="tr"),("العربية",lang=="ar"),("English",lang=="en")]
    for i,(nm,on) in enumerate(grid):
        gw=(W-72)/2; gx=30+(i%2)*(gw+12); gy=y3+128+(i//2)*36
        c.rr((gx,gy,gx+gw,gy+30),11,fill=(52,44,20) if on else BG2,outline=GOLD if on else LINE,width=1)
        c.d.text((sx(gx+gw/2),sx(gy+15)),shp(nm,lang),font=REG(11),fill=GOLDS if on else TEXT,anchor="mm")
    tabbar(c,lang,3); return c.out()

def screen_intro(lang):
    c=C(W,H); c.grad(); c.paste(logo(152),(W//2-76,248))
    c.d.text((sx(W/2),sx(414)),"KEW",font=BD(40),fill=GOLDS,anchor="ma")
    c.d.text((sx(W/2),sx(468)),shp(L[lang]["tag"],lang),font=REG(13),fill=MUTED,anchor="ma")
    c.d.text((sx(W/2),sx(H-58)),"Cybergah Group   cybergah.com",font=REG(11),fill=GOLDS,anchor="ma")
    return c.out()

SCREENS={"intro":screen_intro,"home":screen_home,"downloads":screen_downloads,"player":screen_player,"settings":screen_settings}

if __name__=="__main__":
    if len(sys.argv)>1 and sys.argv[1]=="all":
        for lang in LANGS:
            d=os.path.join(OUT,lang); os.makedirs(d,exist_ok=True)
            for name,fn in SCREENS.items(): fn(lang).save(os.path.join(d,name+".png"))
            print("rendered",lang)
    else:
        lang=sys.argv[1] if len(sys.argv)>1 else "tr"; name=sys.argv[2] if len(sys.argv)>2 else "home"
        os.makedirs(OUT,exist_ok=True); SCREENS[name](lang).save(os.path.join(OUT,f"_preview_{lang}_{name}.png")); print("wrote preview")
