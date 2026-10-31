# Kew — assemble a clean open-source copy into ./github
# Excludes build outputs, node_modules, the signing keystore and all secrets.
import os, shutil, re

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
DST=os.path.join(ROOT,"github")

# directory/file names to skip anywhere
SKIP_DIRS={"node_modules","dist","build",".gradle",".git","__pycache__","github",
           "github-readme","shots","video","Kullanim-Kilavuzu","kaynak kod","release","captures",".idea",".vscode"}
SKIP_FILES_EXACT={"local.properties","kew-release.keystore","google-services.json",
                  "Kew-Tanitim-Haber.docx","Kew-Tanitim-Video.mp4","kew-icon-512.png","capacitor.config.json"}
SKIP_SUFFIX=(".log",".keystore",".jks",".apk",".aab",".mp4",".zip")
SKIP_PREFIX=("icon_preview",)

def ignore(dirpath, names):
    ig=set()
    for n in names:
        full=os.path.join(dirpath,n)
        if os.path.isdir(full):
            if n in SKIP_DIRS: ig.add(n)
            # skip the root assets/ (only holds generated shots/video); keep src/assets
            if n=="assets" and os.path.abspath(dirpath)==os.path.abspath(ROOT): ig.add(n)
            # skip the synced web assets inside android
            if n=="public" and "assets" in dirpath.replace("\\","/"): ig.add(n)
        else:
            if n in SKIP_FILES_EXACT or n.endswith(SKIP_SUFFIX) or n.startswith(SKIP_PREFIX): ig.add(n)
    return ig

if os.path.exists(DST): shutil.rmtree(DST)
shutil.copytree(ROOT, DST, ignore=ignore)

# --- sanitize app/build.gradle: remove keystore + passwords, use debug signing ---
bg=os.path.join(DST,"android","app","build.gradle")
with open(bg,encoding="utf-8") as f: txt=f.read()
txt=re.sub(r"\n\s*signingConfigs\s*\{.*?\n\s*\}\n","\n",txt,flags=re.S,count=1)
txt=txt.replace("signingConfig signingConfigs.release",
    "// Use your OWN release keystore for production (see BUILDING.md).\n            signingConfig signingConfigs.debug")
with open(bg,"w",encoding="utf-8") as f: f.write(txt)

# --- clean .gitignore (do NOT un-ignore the keystore) ---
with open(os.path.join(DST,".gitignore"),"w",encoding="utf-8") as f:
    f.write("\n".join(["node_modules","dist","android/app/build","android/build","android/.gradle",
        "android/local.properties","android/app/src/main/assets/public","android/app/src/main/assets/capacitor.config.json",
        "*.log","*.keystore","*.jks","*.apk","*.aab",".DS_Store","__pycache__/","assets/shots/","Kullanim-Kilavuzu/","*.docx",""]))

# --- BUILDING.md ---
with open(os.path.join(DST,"BUILDING.md"),"w",encoding="utf-8") as f:
    f.write("""# Building Kew

## Web + Android
```bash
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```
The APK appears at `android/app/build/outputs/apk/release/`.
By default the release build is **debug-signed** so it installs without secrets.

## Production signing (your own key)
```bash
keytool -genkeypair -v -keystore my-release.keystore -alias kew \\
  -keyalg RSA -keysize 2048 -validity 10950
```
Then in `android/app/build.gradle` add a `signingConfigs.release` block that reads
your keystore + passwords from environment variables, and set
`signingConfig signingConfigs.release` on the release buildType.
**Never commit your keystore or passwords.**

## Assets / docs (optional)
The `tools/` folder regenerates the icon, sound, screenshots, guide and article:
```bash
python tools/make_icon.py export android/app/src/main/res src/assets
python tools/make_sound.py android/app/src/main/res/raw/keklik.wav src/assets/keklik.wav
python tools/mockups.py all
python tools/make_guide.py
python tools/make_doc.py
```
""")

# count
n=sum(len(fs) for _,_,fs in os.walk(DST))
print("github/ assembled,",n,"files")
print("keystore present in github/?", os.path.exists(os.path.join(DST,"android","app","kew-release.keystore")))
