// Kew — renders every raster logo / icon from the one vector mark
// (shared/assets/keklik.svg). Cybergah Group · GPL-3.0
//
//   swift "KEW WINDOWS/tools/make-icons.swift" shared/assets/keklik.svg .     (run from Kew-v2-kaynak)
//
// Writes: shared/assets/logo.png, the browser-extension icon, the user-guide
// logos, the Android launcher mipmaps and the Windows icon.ico. The macOS
// .icns + tray icons come from make-mac-icons.swift (same svg as input).
import AppKit

let args = CommandLine.arguments
guard args.count == 3, let mark = NSImage(contentsOfFile: args[1]) else {
  print("usage: make-icons.swift <keklik.svg> <Kew-v2-kaynak dir>")
  exit(1)
}
let root = URL(fileURLWithPath: args[2])

/// The mark on a transparent square, drawn as vectors at the target size.
func png(_ size: Int) -> Data {
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
                             samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                             bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  NSGraphicsContext.current?.imageInterpolation = .high
  mark.draw(in: NSRect(x: 0, y: 0, width: size, height: size), from: .zero, operation: .sourceOver, fraction: 1)
  NSGraphicsContext.restoreGraphicsState()
  return rep.representation(using: .png, properties: [:])!
}

func write(_ data: Data, _ rel: String) throws {
  let url = root.appendingPathComponent(rel)
  try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
  try data.write(to: url)
  print("  \(rel)")
}

// 256px logo: app header, browser extension, user guide
let logo = png(256)
for rel in ["shared/assets/logo.png", "KEW WINDOWS/browser-extension/icon.png",
            "kew/Kullanim-Kilavuzu/img/logo.png", "kew/Kullanim-Kilavuzu/print/img/logo.png"] {
  try write(logo, rel)
}

// Android launcher (legacy square/round + adaptive foreground, same art)
let res = "kew/android/app/src/main/res"
for (dpi, size) in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)] {
  let data = png(size)
  for name in ["ic_launcher", "ic_launcher_round", "ic_launcher_foreground"] {
    try write(data, "\(res)/mipmap-\(dpi)/\(name).png")
  }
}

// Windows .ico — PNG-compressed entries (supported since Vista)
let sizes = [16, 24, 32, 48, 64, 128, 256]
let images = sizes.map(png)
var ico = Data()
func le16(_ v: Int) { ico.append(contentsOf: [UInt8(v & 0xff), UInt8(v >> 8 & 0xff)]) }
func le32(_ v: Int) { le16(v & 0xffff); le16(v >> 16) }
le16(0); le16(1); le16(sizes.count)
var offset = 6 + 16 * sizes.count
for (s, img) in zip(sizes, images) {
  ico.append(UInt8(s == 256 ? 0 : s)); ico.append(UInt8(s == 256 ? 0 : s))
  ico.append(0); ico.append(0) // palette, reserved
  le16(1); le16(32) // planes, bpp
  le32(img.count); le32(offset)
  offset += img.count
}
images.forEach { ico.append($0) }
try write(ico, "KEW WINDOWS/resources/icon.ico")
print("ok")
