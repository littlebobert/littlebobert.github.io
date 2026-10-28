// Generates the decorative seals on the Karui pages from scans of real stamps:
//   assets/karui-seal.png                 51 points tall at 4×, beside the footer photo
//   assets/karui-seal-large.png           204 points tall at 3×, for /seal
//   assets/karui-seal-tagline.png         112 points tall at 3×, stamped beside the hero
//   assets/karui-seal-tagline-large.png   283 points tall at 3×, for /hanko
//
//   swift scripts/generate-karui-seal.swift
//
// The scans, in scripts/karui-seal-scans, are hand-carved stamps on transparent
// paper: ガルシア, the footer's surname seal (認印), and 通知をかるく, the App Store
// name's tagline. Each is cropped to its border, ignoring stray specks of ink
// outside it, and set on white, which the ink-in animation needs on every side of
// the border. Each seal keeps its scan's proportions, so the script prints the
// width each comes out at; the pages give the same sizes.
import AppKit

let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()

struct Scan {
    let image: CGImage
    // The border's bounds, in the scan's pixels, from the top left.
    let crop: CGRect
}

func loadScan(_ path: String) -> Scan {
    let url = root.appendingPathComponent(path)
    let image = NSImage(contentsOf: url)!.cgImage(forProposedRect: nil, context: nil, hints: nil)!
    let width = image.width, height = image.height
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    let context = CGContext(
        data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    // Ink is solid and red; the paper is transparent, with a little gray at the edges.
    // The bitmap's rows run from the top.
    func isInk(_ x: Int, _ y: Int) -> Bool {
        let i = (y * width + x) * 4
        return pixels[i + 3] > 128 && Int(pixels[i]) - Int(pixels[i + 1]) > 60
    }
    // The border runs the length of every row and column inside it, so a row or column
    // with ink across more than a tenth of it is inside; specks outside never are.
    let rows = (0..<height).filter { y in (0..<width).filter { isInk($0, y) }.count > width / 10 }
    let columns = (0..<width).filter { x in (0..<height).filter { isInk(x, $0) }.count > height / 10 }
    let crop = CGRect(
        x: columns.first!, y: rows.first!,
        width: columns.last! - columns.first! + 1, height: rows.last! - rows.first! + 1
    )
    return Scan(image: image, crop: crop)
}

func render(_ scan: Scan, pointHeight: CGFloat, scale: CGFloat, to path: String) {
    let pointWidth = (pointHeight * scan.crop.width / scan.crop.height).rounded()
    let width = Int(pointWidth * scale), height = Int(pointHeight * scale)
    let context = CGContext(
        data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    context.interpolationQuality = .high
    context.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    // Draw the whole scan, scaled so its border fills the image.
    let scaleX = CGFloat(width) / scan.crop.width, scaleY = CGFloat(height) / scan.crop.height
    let scanHeight = CGFloat(scan.image.height)
    context.draw(scan.image, in: CGRect(
        x: -scan.crop.minX * scaleX,
        y: -(scanHeight - scan.crop.maxY) * scaleY,
        width: CGFloat(scan.image.width) * scaleX,
        height: scanHeight * scaleY
    ))
    let outputURL = root.appendingPathComponent(path)
    let output = NSBitmapImageRep(cgImage: context.makeImage()!)
    try! output.representation(using: .png, properties: [:])!.write(to: outputURL)
    print("Wrote \(path): \(Int(pointWidth)) × \(Int(pointHeight)) points, \(width) × \(height) px")
}

let name = loadScan("scripts/karui-seal-scans/garcia.png")
// As tall as the 40 × 51-point footer photo beside it.
render(name, pointHeight: 51, scale: 4, to: "assets/karui-seal.png")
// 4× the footer size in points, at 3× for sharp phone screens.
render(name, pointHeight: 204, scale: 3, to: "assets/karui-seal-large.png")

let tagline = loadScan("scripts/karui-seal-scans/tsuchi-wo-karuku.png")
// Stamped beside the hero the first time the page loads.
render(tagline, pointHeight: 112, scale: 3, to: "assets/karui-seal-tagline.png")
// The same seal two and a half times as tall, for /hanko.
render(tagline, pointHeight: 283, scale: 3, to: "assets/karui-seal-tagline-large.png")
