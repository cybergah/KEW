// electron-builder afterPack hook — macOS builds without an Apple Developer ID.
// Repackaging Electron invalidates its signature, and Apple Silicon refuses to
// run unsigned code, so the whole .app (helpers, frameworks, yt-dlp, ffmpeg)
// gets an ad-hoc signature here. Users still see the "unidentified developer"
// prompt on first launch (right-click → Open), but the app runs.
const { execFileSync } = require("child_process");
const path = require("path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  // universal build: the x64/arm64 halves must stay byte-identical until they
  // are merged, so only the final universal .app is signed
  if (/-temp$/.test(context.appOutDir)) return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", app], { stdio: "inherit" });
};
