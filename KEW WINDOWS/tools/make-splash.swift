// Kew — Android launch screens (drawable*/splash.png) in the intro's look:
// deep-green radial stage, gold ring around the dark medallion, keklik inside.
// Cybergah Group · GPL-3.0
//
//   swift "KEW WINDOWS/tools/make-splash.swift" shared/assets/keklik.svg .     (run from Kew-v2-kaynak)
import AppKit

let args = CommandLine.arguments
guard args.count == 3, let mark = NSImage(contentsOfFile: args[1]) else {
  print("usage: make-splash.swift <keklik.svg> <Kew-v2-kaynak dir>")
  exit(1)
}
let res = URL(fileURLWithPath: args[2]).appendingPathComponent("kew/android/app/src/main/res")

func rgb(_ hex: Int, _ a: CGFloat = 1) -> NSColor {
  NSColor(srgbRed: CGFloat(hex >> 16 & 0xff) / 255, green: CGFloat(hex >> 8 & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: a)
}

func splash(_ w: Int, _ h: Int) -> Data {
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8,
                             samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                             bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  NSGraphicsContext.current?.imageInterpolation = .high
  let W = CGFloat(w), H = CGFloat(h)
  let full = NSRect(x: 0, y: 0, width: W, height: H)

  // stage (y is flipped: the light sits a little above the middle)
  let stage = NSGradient(colors: [rgb(0x0f3420), rgb(0x072014), rgb(0x04120a)], atLocations: [0, 0.62, 1], colorSpace: .sRGB)!
  stage.draw(in: NSBezierPath(rect: full), relativeCenterPosition: NSPoint(x: 0, y: 0.2))

  // emblem, sized to the short side so it survives any crop of the 9-patch-less scale
  let d = min(W, H) * 0.42
  let c = NSPoint(x: W / 2, y: H / 2)
  let ring = NSRect(x: c.x - d / 2, y: c.y - d / 2, width: d, height: d)

  let glow = NSGradient(colors: [rgb(0xe2a82c, 0.22), rgb(0xe2a82c, 0)])!
  glow.draw(fromCenter: c, radius: d * 0.4, toCenter: c, radius: d * 1.05, options: [.drawsBeforeStartingLocation])

  let gold = NSGradient(colors: [rgb(0xf2c862), rgb(0xe2a82c), rgb(0xa8730f)], atLocations: [0, 0.5, 1], colorSpace: .sRGB)!
  gold.draw(in: NSBezierPath(ovalIn: ring), angle: -45)

  let disc = ring.insetBy(dx: d * 0.045, dy: d * 0.045)
  let discFill = NSGradient(colors: [rgb(0x1f6338), rgb(0x0d2c19), rgb(0x071d10)], atLocations: [0, 0.62, 1], colorSpace: .sRGB)!
  discFill.draw(in: NSBezierPath(ovalIn: disc), relativeCenterPosition: NSPoint(x: -0.3, y: 0.4))

  let bird = disc.insetBy(dx: disc.width * 0.04, dy: disc.width * 0.04)
  mark.draw(in: bird, from: .zero, operation: .sourceOver, fraction: 1)
  NSGraphicsContext.restoreGraphicsState()
  return rep.representation(using: .png, properties: [:])!
}

func write(_ data: Data, _ dir: String) throws {
  let url = res.appendingPathComponent("\(dir)/splash.png")
  try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
  try data.write(to: url)
  print("  \(dir)/splash.png")
}

try write(splash(480, 320), "drawable")
for (dpi, w, h) in [("mdpi", 480, 320), ("hdpi", 800, 480), ("xhdpi", 1280, 720), ("xxhdpi", 1600, 960), ("xxxhdpi", 1920, 1280)] {
  try write(splash(w, h), "drawable-land-\(dpi)")
  try write(splash(h, w), "drawable-port-\(dpi)")
}
print("ok")
