// Generates assets/karui-qr.png, the rounded QR code shown at karui.jp/#qr.
//
//   swift scripts/generate-karui-qr.swift
//
// Core Image's rounded QR generator draws the code; the Karui icon goes in the
// middle. High error correction is what lets the icon cover the center and the
// code still scan. The script decodes its own output and fails if it doesn't
// read back as the URL, so a broken code never gets written.
import AppKit
import CoreImage

let url = "https://karui.jp/"
let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
let iconPath = root.appendingPathComponent("assets/karui-icon.png").path
let outputURL = root.appendingPathComponent("assets/karui-qr.png")

let filter = CIFilter(name: "CIRoundedQRCodeGenerator")!
filter.setValue(url.data(using: .utf8), forKey: "inputMessage")
filter.setValue("H", forKey: "inputCorrectionLevel")
// About 720 pixels in all: sharp on a phone, small enough for the landing page.
filter.setValue(20, forKey: "inputScale")
filter.setValue(2, forKey: "inputRoundedMarkers")
filter.setValue(1, forKey: "inputRoundedData")
filter.setValue(0.3, forKey: "inputCenterSpaceSize")
filter.setValue(CIColor(red: 1, green: 1, blue: 1), forKey: "inputColor0")
// Karui's ink, #1a211e.
filter.setValue(CIColor(red: 0x1a / 255, green: 0x21 / 255, blue: 0x1e / 255), forKey: "inputColor1")
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
NSColor.white.setFill()
NSRect(x: 0, y: 0, width: canvas, height: canvas).fill()
NSGraphicsContext.current!.cgContext.draw(code, in: CGRect(x: margin, y: margin, width: size, height: size))
// Core Image fills the center space with the ink color, so a white square covers
// all of it before the icon goes on top.
let hole = size * 0.3 + 4
NSRect(x: (canvas - hole) / 2, y: (canvas - hole) / 2, width: hole, height: hole).fill()
let tile = size * 0.24
let tileRect = NSRect(x: (canvas - tile) / 2, y: (canvas - tile) / 2, width: tile, height: tile)
NSBezierPath(roundedRect: tileRect, xRadius: tile * 0.22, yRadius: tile * 0.22).addClip()
NSImage(contentsOfFile: iconPath)!.draw(in: tileRect)
NSGraphicsContext.restoreGraphicsState()

let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
let decoded = detector.features(in: CIImage(cgImage: bitmap.cgImage!)).compactMap { ($0 as? CIQRCodeFeature)?.messageString }
guard decoded == [url] else {
    FileHandle.standardError.write("The generated code reads as \(decoded), not \(url); nothing written.\n".data(using: .utf8)!)
    exit(1)
}
try! bitmap.representation(using: .png, properties: [:])!.write(to: outputURL)
print("Wrote \(outputURL.path) (\(Int(canvas)) px), which decodes as \(url)")
