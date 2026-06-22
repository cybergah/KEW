# Building Kew

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
keytool -genkeypair -v -keystore my-release.keystore -alias kew \
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
