// Kew — builds the macOS app icon (.iconset → .icns via iconutil) and the
// menu-bar tray icon from the keklik artwork. Cybergah Group · GPL-3.0
//
//   swift tools/make-mac-icons.swift ../shared/assets/keklik.svg resources-mac
//   iconutil -c icns resources-mac/icon.iconset -o resources-mac/icon.icns
//
// App icon: Apple's rounded-square grid (824/1024 body) with the app's deep
// forest-green gradient and a thin gold rim, bird centred on top.
import AppKit

let args = CommandLine.arguments
guard args.count == 3, let bird = NSImage(contentsOfFile: args[1]) else {
  print("usage: make-mac-icons.swift <bird.png> <out dir>")
  exit(1)
}
let outDir = URL(fileURLWithPath: args[2])

func rgb(_ hex: UInt32, _ a: CGFloat = 1) -> NSColor {
  NSColor(srgbRed: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255,
          blue: CGFloat(hex & 0xff) / 255, alpha: a)
}

func render(_ size: Int, _ draw: (CGFloat) -> Void) -> Data {
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
                             samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                             bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  NSGraphicsContext.current?.imageInterpolation = .high
  draw(CGFloat(size))
  NSGraphicsContext.restoreGraphicsState()
  return rep.representation(using: .png, properties: [:])!
}

func appIcon(_ s: CGFloat) {
  let k = s / 1024
  let body = NSRect(x: 100 * k, y: 100 * k, width: 824 * k, height: 824 * k)
  let shape = NSBezierPath(roundedRect: body, xRadius: 185 * k, yRadius: 185 * k)

  // soft drop shadow under the tile
  NSGraphicsContext.saveGraphicsState()
  let shadow = NSShadow()
  shadow.shadowColor = NSColor.black.withAlphaComponent(0.35)
  shadow.shadowBlurRadius = 28 * k
  shadow.shadowOffset = NSSize(width: 0, height: -10 * k)
  shadow.set()
  rgb(0x0d2c19).setFill()
  shape.fill()
  NSGraphicsContext.restoreGraphicsState()

  // deep forest gradient + top-right glow (matches the app background)
  NSGradient(colors: [rgb(0x1f6338), rgb(0x0d2c19), rgb(0x071d10)], atLocations: [0, 0.55, 1],
             colorSpace: .deviceRGB)!.draw(in: shape, angle: -70)
  NSGraphicsContext.saveGraphicsState()
  shape.addClip()
  NSGradient(starting: rgb(0xe2a82c, 0.22), ending: rgb(0xe2a82c, 0))!
    .draw(fromCenter: NSPoint(x: 760 * k, y: 860 * k), radius: 0,
          toCenter: NSPoint(x: 760 * k, y: 860 * k), radius: 520 * k, options: [])
  NSGraphicsContext.restoreGraphicsState()

  // thin gold rim
  let rim = NSBezierPath(roundedRect: body.insetBy(dx: 3 * k, dy: 3 * k), xRadius: 182 * k, yRadius: 182 * k)
  rim.lineWidth = 6 * k
  rgb(0xe2a82c, 0.55).setStroke()
  rim.stroke()

  // the keklik
  bird.draw(in: NSRect(x: 172 * k, y: 150 * k, width: 680 * k, height: 680 * k), from: .zero,
            operation: .sourceOver, fraction: 1)
}

let iconset = outDir.appendingPathComponent("icon.iconset")
try? FileManager.default.removeItem(at: iconset)
try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)
for base in [16, 32, 128, 256, 512] {
  try render(base, appIcon).write(to: iconset.appendingPathComponent("icon_\(base)x\(base).png"))
  try render(base * 2, appIcon).write(to: iconset.appendingPathComponent("icon_\(base)x\(base)@2x.png"))
}

// menu-bar icon: the bird alone, 18pt (+@2x)
func trayIcon(_ s: CGFloat) {
  bird.draw(in: NSRect(x: 0, y: 0, width: s, height: s), from: .zero, operation: .sourceOver, fraction: 1)
}
try render(18, trayIcon).write(to: outDir.appendingPathComponent("tray.png"))
try render(36, trayIcon).write(to: outDir.appendingPathComponent("tray@2x.png"))
print("ok")
