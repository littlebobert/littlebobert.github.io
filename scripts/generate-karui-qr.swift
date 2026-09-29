// Generates assets/karui-qr.png, the rounded QR code in Karui's ink with the app
// icon in the middle, one of the codes at karui.jp/#qr. (The seal one is made by
// generate-karui-seal-qr.swift.)
//
//   swift scripts/generate-karui-qr.swift
//
// Core Image's rounded QR generator draws the code. High error correction is what
// lets the icon cover the center and the code still scan. The script decodes the
// output and fails if it doesn't read back as the URL, so a broken code never
// gets written.
import AppKit
import CoreImage

let url = "https://karui.jp/"
let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
let iconPath = root.appendingPathComponent("assets/karui-icon.png").path

func renderCode(to path: String) {
    let ink: (r: CGFloat, g: CGFloat, b: CGFloat) = (0x1a / 255, 0x21 / 255, 0x1e / 255)  // Karui's ink, #1a211e
    let centerSpace: CGFloat = 0.3

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
    let margin = size * 0.08
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
    // all of it before the icon goes on top.
    let hole = size * centerSpace + 4
    NSRect(x: (canvas - hole) / 2, y: (canvas - hole) / 2, width: hole, height: hole).fill()

    let tile = size * 0.24
    let tileRect = NSRect(x: (canvas - tile) / 2, y: (canvas - tile) / 2, width: tile, height: tile)
    NSBezierPath(roundedRect: tileRect, xRadius: tile * 0.22, yRadius: tile * 0.22).addClip()
    NSImage(contentsOfFile: iconPath)!.draw(in: tileRect)
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

renderCode(to: "assets/karui-qr.png")
