# Kew — promo/AD video (vertical 1080x1920), Turkish female narration (Emel).
# Brand spoken as "Kev" / "Sibergah" (display stays KEW / Cybergah).
# Ambient music bed mixed under the voice. Cybergah Group.
import os, subprocess, asyncio, math, struct, wave
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import edge_tts

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
SHOTS=os.path.join(ROOT,"assets","shots","tr"); LOGO=os.path.join(ROOT,"src","assets","logo.png")
WORK=os.path.join(ROOT,"assets","video"); os.makedirs(WORK,exist_ok=True)
OUT=os.path.join(ROOT,"Kew-Tanitim-Video.mp4")
VOICE="tr-TR-EmelNeural"; WV,HV=1080,1920; F="C:/Windows/Fonts/"
def F_(n,s): return ImageFont.truetype(F+n,s)
GOLD=(202,166,74); GOLDS=(227,200,120); CREAM=(241,232,207); TEXT=(238,243,236); MUTED=(150,170,155)
LOGO_IMG=Image.open(LOGO).convert("RGBA")

def bg():
    im=Image.new("RGB",(WV,HV),(7,18,11)); d=ImageDraw.Draw(im)
    for y in range(HV):
        g=max(0.0,1-(y/HV/0.72)); c=tuple(int((7,18,11)[i]+((26,56,36)[i]-(7,18,11)[i])*g) for i in range(3))
        d.line([(0,y),(WV,y)],fill=c)
    return im

def phone(shot_path,target_h=1180):
    s=Image.open(shot_path).convert("RGBA"); w,h=s.size; sc=target_h/h; nw,nh=int(w*sc),int(h*sc)
    s=s.resize((nw,nh),Image.LANCZOS)
    rad=46; mask=Image.new("L",(nw,nh),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,nw,nh],radius=rad,fill=255)
    bez=Image.new("RGBA",(nw+26,nh+26),(0,0,0,0)); ImageDraw.Draw(bez).rounded_rectangle([0,0,nw+26,nh+26],radius=rad+12,fill=(22,34,26,255))
    bez.paste(s,(13,13),mask)
    sh=Image.new("RGBA",(nw+100,nh+100),(0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle([34,42,nw+66,nh+72],radius=rad+20,fill=(0,0,0,160))
    sh=sh.filter(ImageFilter.GaussianBlur(20)); sh.alpha_composite(bez,(37,24)); return sh

def ctr(d,cx,y,t,f,fill,anchor="ma"): d.text((cx,y),t,font=f,fill=fill,anchor=anchor)
def wrap(d,t,cx,y,f,fill,maxw,lh,anchor="ma"):
    words=t.split(); line=""; yy=y
    for w in words:
        tt=(line+" "+w).strip()
        if d.textlength(tt,font=f)>maxw and line: d.text((cx,yy),line,font=f,fill=fill,anchor=anchor); line=w; yy+=lh
        else: line=tt
    if line: d.text((cx,yy),line,font=f,fill=fill,anchor=anchor)
    return yy

def chips(d,cx,y,items,f):
    gap=24; widths=[d.textlength(t,font=f)+44 for t in items]; total=sum(widths)+gap*(len(items)-1); x=cx-total/2
    for t,w in zip(items,widths):
        d.rounded_rectangle([x,y,x+w,y+58],radius=29,outline=GOLD,width=3)
        d.text((x+w/2,y+29),t,font=f,fill=GOLDS,anchor="mm"); x+=w+gap

def scene_logo(title,sub,chiprow=None):
    im=bg(); d=ImageDraw.Draw(im)
    lg=LOGO_IMG.resize((430,430),Image.LANCZOS); im.paste(lg,(WV//2-215,500),lg)
    ctr(d,WV//2,980,title,F_("segoeuib.ttf",96),GOLDS)
    wrap(d,sub,WV//2,1130,F_("segoeui.ttf",50),CREAM,920,66)
    if chiprow: chips(d,WV//2,1260,chiprow,F_("seguisb.ttf",34))
    ctr(d,WV//2,HV-140,"Cybergah Group   ·   cybergah.com",F_("segoeui.ttf",40),GOLDS)
    return im

def scene_keywords(words,sub):
    im=bg(); d=ImageDraw.Draw(im)
    lg=LOGO_IMG.resize((200,200),Image.LANCZOS); im.paste(lg,(WV//2-100,250),lg)
    y=620
    for w in words:
        ctr(d,WV//2,y,w,F_("segoeuib.ttf",110),GOLDS); y+=170
        if w!=words[-1]: d.ellipse([WV//2-6,y-92,WV//2+6,y-80],fill=GOLD)
    wrap(d,sub,WV//2,y+30,F_("segoeui.ttf",46),CREAM,900,62)
    ctr(d,WV//2,HV-140,"cybergah.com",F_("segoeui.ttf",40),GOLDS)
    return im

def scene_shot(shot,title):
    im=bg(); d=ImageDraw.Draw(im)
    wrap(d,title,WV//2,150,F_("segoeuib.ttf",78),TEXT,1000,94)
    p=phone(os.path.join(SHOTS,shot),target_h=1150); im.paste(p,(WV//2-p.width//2,430),p)
    ctr(d,WV//2,HV-90,"cybergah.com",F_("segoeui.ttf",38),GOLDS)
    return im

# (image_fn, narration[Kev/Sibergah phonetic])
SCENES=[
 (lambda:scene_logo("KEW","Özgürlüğün yeni adı.",["ÜCRETSİZ","ANONİM","AÇIK KAYNAK"]),
  "Özgürlüğün yeni adı: Kev. Ücretsiz, anonim ve tamamen açık kaynak."),
 (lambda:scene_shot("home.png","YAPIŞTIR — İNDİR"),
  "YouTube, X, TikTok, Instagram. Linki yapıştır, Kev gerisini halletsin. Saniyeler içinde indir."),
 (lambda:scene_shot("downloads.png","SENİN CİHAZIN,\nSENİN KONTROLÜN"),
  "Koca oynatma listeleri tek dokunuşla insin. Dilediğini duraklat, iptal et. Her şey yalnızca senin cihazında."),
 (lambda:scene_keywords(["HESAP YOK","TAKİP YOK","REKLAM YOK"],"Kew seni izlemez, verini toplamaz. Gizliliğin sana ait."),
  "Hesap yok. Takip yok. Reklam yok. Kev seni izlemez, verilerini toplamaz. Gizliliğin sana ait."),
 (lambda:scene_shot("settings.png","AÇIK KAYNAK · 5 DİL"),
  "Beş dilde, herkes için. Ve tamamen açık kaynak; gizleyecek hiçbir şeyimiz yok."),
 (lambda:scene_logo("KEW","Özgür · Anonim · Ücretsiz",["İNDİR","İZLE","PAYLAŞ"]),
  "Kev. Özgür, anonim ve ücretsiz. Sibergah Grup. sibergah nokta kom."),
]

async def tts(text,path): await edge_tts.Communicate(text,VOICE,rate="+2%").save(path)
def dur(p): return float(subprocess.run(["ffprobe","-v","quiet","-show_entries","format=duration","-of","csv=p=0",p],capture_output=True,text=True).stdout.strip())
def run(cmd):
    r=subprocess.run(cmd,capture_output=True,text=True)
    if r.returncode!=0: print("FFMPEG ERR:",r.stderr[-900:]); raise SystemExit(1)

def gen_music(path,seconds,sr=44100):
    # warm ambient pad: 4-chord progression, overlap-added 4s blocks.
    chords=[[220.0,261.63,329.63],[174.61,220.0,277.18],[196.0,246.94,329.63],[164.81,207.65,261.63]]
    blk=4.0; n_blk=int(blk*sr)
    def block(freqs):
        buf=[0.0]*n_blk
        for i in range(n_blk):
            t=i/sr; env=math.sin(math.pi*t/blk)**1.3  # raised cosine-ish fade in/out
            trem=0.92+0.08*math.sin(2*math.pi*0.18*t)
            s=0.0
            for f in freqs: s+=math.sin(2*math.pi*f*t)+0.25*math.sin(2*math.pi*2*f*t)
            s+=0.4*math.sin(2*math.pi*(freqs[0]/2)*t)  # soft bass
            buf[i]=env*trem*s/ (len(freqs)*1.6)
        return buf
    cbuf=[block(c) for c in chords]
    total=int(seconds*sr); out=[0.0]*(total+n_blk)
    step=int(2.6*sr); k=0; pos=0
    while pos<total:
        b=cbuf[k%4]
        for i in range(n_blk):
            if pos+i<len(out): out[pos+i]+=b[i]
        pos+=step; k+=1
    peak=max(1e-6,max(abs(x) for x in out[:total]))
    data=b"".join(struct.pack("<h",int(max(-1,min(1,out[i]/peak*0.85))*32767)) for i in range(total))
    w=wave.open(path,"w"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(data); w.close()

def main():
    clips=[]
    for i,(mk,narr) in enumerate(SCENES):
        ip=os.path.join(WORK,f"s{i}.png"); mk().convert("RGB").save(ip)
        ap=os.path.join(WORK,f"s{i}.mp3"); asyncio.run(tts(narr,ap))
        d=dur(ap); sd=round(d+0.85,2); frames=int(sd*30); cp=os.path.join(WORK,f"s{i}.mp4")
        vf=(f"scale={WV}:{HV},zoompan=z='min(zoom+0.0005,1.07)':d={frames}:s={WV}x{HV}:fps=30,"
            f"fade=t=in:st=0:d=0.45,fade=t=out:st={sd-0.5:.2f}:d=0.5,format=yuv420p")
        run(["ffmpeg","-y","-loop","1","-i",ip,"-i",ap,"-filter_complex",f"[0:v]{vf}[v]","-map","[v]","-map","1:a",
             "-c:v","libx264","-r","30","-t",str(sd),"-c:a","aac","-b:a","192k","-ar","44100","-pix_fmt","yuv420p",cp])
        clips.append(cp); print(f"scene {i}: voice {d:.1f}s -> {sd}s")
    lst=os.path.join(WORK,"list.txt")
    with open(lst,"w") as f:
        for c in clips: f.write(f"file '{c.replace(os.sep,'/')}'\n")
    vo=os.path.join(WORK,"vo.mp4"); run(["ffmpeg","-y","-f","concat","-safe","0","-i",lst,"-c","copy",vo])
    total=dur(vo); print("voice video:",f"{total:.1f}s — adding music")
    mus=os.path.join(WORK,"music.wav"); gen_music(mus,total+1)
    af=(f"[1:a]volume=0.12,afade=t=in:st=0:d=1.5,afade=t=out:st={total-2.5:.2f}:d=2.5[m];"
        f"[0:a][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]")
    run(["ffmpeg","-y","-i",vo,"-i",mus,"-filter_complex",af,"-map","0:v","-map","[a]",
         "-c:v","copy","-c:a","aac","-b:a","192k",OUT])
    print("VIDEO:",OUT,f"{dur(OUT):.1f}s")

if __name__=="__main__": main()
