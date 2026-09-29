// Generates the rounded QR codes shown at karui.jp/#qr, swiped between:
//   assets/karui-qr.png        Karui's ink, with the app icon in the middle
//   assets/karui-qr-hanko.png  seal red (朱色) in a seal-style frame, with 軽 as a
//                              square seal in the middle
//
//   swift scripts/generate-karui-qr.swift
//
// Core Image's rounded QR generator draws the codes. High error correction is what
// lets the icon or seal cover the center and the code still scan. The script
// decodes each output and fails if it doesn't read back as the URL, so a broken
// code never gets written.
import AppKit
import CoreImage
import CoreText

let url = "https://karui.jp/"
let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
let iconPath = root.appendingPathComponent("assets/karui-icon.png").path

enum Style { case icon, hanko }

func renderCode(_ style: Style, to path: String) {
    let ink: (r: CGFloat, g: CGFloat, b: CGFloat) = style == .icon
        ? (0x1a / 255, 0x21 / 255, 0x1e / 255)  // Karui's ink, #1a211e
        : (0.80, 0.13, 0.10)  // shuiro, the vermilion of seal ink
    let inkColor = NSColor(srgbRed: ink.r, green: ink.g, blue: ink.b, alpha: 1)
    // The largest blank center Core Image allows at level H is 33%. The seal
    // fills it exactly, so it's as big as it can be without covering any data.
    let centerSpace: CGFloat = style == .icon ? 0.3 : 0.33

    let filter = CIFilter(name: "CIRoundedQRCodeGenerator")!
    filter.setValue(url.data(using: .utf8), forKey: "inputMessage")
    filter.setValue("H", forKey: "inputCorrectionLevel")
    // About 720 pixels in all: sharp on a phone, small enough for the landing page.
    filter.setValue(20, forKey: "inputScale")
    filter.setValue(2, forKey: "inputRoundedMarkers")
    filter.setValue(1, forKey: "inputRoundedData")
    filter.setValue(centerSpace, forKey: "inputCenterSpaceSize")
    filter.setValue(CIColor(red: 1, green: 1, blue: 1), forKey: "inputColor0")
    filter.setValue(CIColor(red: ink.r, green: ink.g, blue: ink.b), forKey: "inputColor1")
    let code = CIContext().createCGImage(filter.outputImage!, from: filter.outputImage!.extent)!

    let size = CGFloat(code.width)
    let margin = size * (style == .icon ? 0.08 : 0.10)
    let canvas = size + margin * 2
    let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: Int(canvas), pixelsHigh: Int(canvas),
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    )!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    let context = NSGraphicsContext.current!.cgContext
    NSColor.white.setFill()
    NSRect(x: 0, y: 0, width: canvas, height: canvas).fill()
    context.draw(code, in: CGRect(x: margin, y: margin, width: size, height: size))
    // Core Image fills the center space with the ink color, so a white square covers
    // all of it before the icon or seal goes on top.
    let hole = size * centerSpace + 4
    NSRect(x: (canvas - hole) / 2, y: (canvas - hole) / 2, width: hole, height: hole).fill()

    switch style {
    case .icon:
        let tile = size * 0.24
        let tileRect = NSRect(x: (canvas - tile) / 2, y: (canvas - tile) / 2, width: tile, height: tile)
        NSBezierPath(roundedRect: tileRect, xRadius: tile * 0.22, yRadius: tile * 0.22).addClip()
        NSImage(contentsOfFile: iconPath)!.draw(in: tileRect)
    case .hanko:
        // A seal-style frame around the whole code, inside the quiet zone.
        let frameInset = margin * 0.45
        let frame = NSBezierPath(
            roundedRect: NSRect(x: 0, y: 0, width: canvas, height: canvas).insetBy(dx: frameInset, dy: frameInset),
            xRadius: size * 0.06,
            yRadius: size * 0.06
        )
        frame.lineWidth = size * 0.022
        inkColor.setStroke()
        frame.stroke()
        // 軽, the kanji in 軽い (karui, light), white on red like a seal impression.
        let tile = size * centerSpace
        let tileRect = NSRect(x: (canvas - tile) / 2, y: (canvas - tile) / 2, width: tile, height: tile)
        inkColor.setFill()
        NSBezierPath(roundedRect: tileRect, xRadius: tile * 0.12, yRadius: tile * 0.12).fill()
        let font = NSFont(name: "ToppanBunkyuMidashiMinchoStdN-ExtraBold", size: tile * 0.78)!
        let line = CTLineCreateWithAttributedString(NSAttributedString(
            string: "軽",
            attributes: [.font: font, .foregroundColor: NSColor.white]
        ))
        let bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
        context.textPosition = CGPoint(x: canvas / 2 - bounds.midX, y: canvas / 2 - bounds.midY)
        CTLineDraw(line, context)
    }
    NSGraphicsContext.restoreGraphicsState()

    let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
    let decoded = detector.features(in: CIImage(cgImage: bitmap.cgImage!)).compactMap { ($0 as? CIQRCodeFeature)?.messageString }
    guard decoded == [url] else {
        FileHandle.standardError.write("\(path) reads as \(decoded), not \(url); nothing written.\n".data(using: .utf8)!)
        exit(1)
    }
    let outputURL = root.appendingPathComponent(path)
    try! bitmap.representation(using: .png, properties: [:])!.write(to: outputURL)
    print("Wrote \(outputURL.path) (\(Int(canvas)) px), which decodes as \(url)")
}

renderCode(.icon, to: "assets/karui-qr.png")
renderCode(.hanko, to: "assets/karui-qr-hanko.png")
