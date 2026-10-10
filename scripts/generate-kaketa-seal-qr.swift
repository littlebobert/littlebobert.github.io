// Generates the animated seal at kaketa.jp/qr, where the tagline 書いて覚える in a
// narrow seal frame turns into a QR code for kaketa.jp. Copied from Karui's
// generate-karui-seal-qr.swift.
//   assets/kaketa-qr-seal.png        the red QR code in a square frame, where it ends
//   assets/kaketa-qr-seal-name.png   the seal's red lettering alone, on transparent;
//                                    the page draws the frame so it can widen
//   assets/kaketa-qr-seal.json       each data dot's start (on the lettering) and end
//                                    (its QR module), extra dots, markers, and frames
//
//   swift scripts/generate-kaketa-seal-qr.swift
//
// The page animates the dots from one to the other, then shows the QR image, so
// what people scan is exactly this file. The script decodes it and fails if it
// doesn't read back as the URL, so a broken code never gets written.
import AppKit
import CoreImage
import CoreText

let url = "https://kaketa.jp/"
let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
let ink = NSColor(srgbRed: 0.78, green: 0.26, blue: 0.17, alpha: 1)  // Kaketa's vermilion, the correction pen
let fontName = "ToppanBunkyuMidashiMinchoStdN-ExtraBold"
let message = url.data(using: .utf8)!

// The plain generator at one pixel per module gives the module grid; the rounded
// one draws the code. Same message and correction level, so the same grid. Level M
// leaves the center as ordinary code; H would fill it with a solid block.
let plain = CIFilter(name: "CIQRCodeGenerator")!
plain.setValue(message, forKey: "inputMessage")
plain.setValue("M", forKey: "inputCorrectionLevel")
let plainImage = plain.outputImage!
let gridPixels = Int(plainImage.extent.width)
var grid = [UInt8](repeating: 0, count: gridPixels * gridPixels * 4)
CIContext().render(plainImage, toBitmap: &grid, rowBytes: gridPixels * 4, bounds: plainImage.extent, format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())

let rounded = CIFilter(name: "CIRoundedQRCodeGenerator")!
rounded.setValue(message, forKey: "inputMessage")
rounded.setValue("M", forKey: "inputCorrectionLevel")
rounded.setValue(20, forKey: "inputScale")
rounded.setValue(2, forKey: "inputRoundedMarkers")
rounded.setValue(1, forKey: "inputRoundedData")
rounded.setValue(0, forKey: "inputCenterSpaceSize")
rounded.setValue(CIColor(red: 1, green: 1, blue: 1), forKey: "inputColor0")
rounded.setValue(CIColor(red: 0.78, green: 0.26, blue: 0.17), forKey: "inputColor1")
let code = CIContext().createCGImage(rounded.outputImage!, from: rounded.outputImage!.extent)!

let size = CGFloat(code.width)
let margin = size * 0.10, canvas = size + margin * 2
let frameInset = margin * 0.45, frameWidth = size * 0.022, frameRadius = size * 0.06
// Both generators pad the grid with the same quiet zone, so module (col, row) of the
// plain grid is centered at margin + (col + 0.5) * pitch in the rounded one.
let pitch = size / CGFloat(gridPixels)

func render(framed: Bool = true, _ body: (CGContext) -> Void) -> NSBitmapImageRep {
    let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: Int(canvas), pixelsHigh: Int(canvas),
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    )!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    let context = NSGraphicsContext.current!.cgContext
    guard framed else {
        body(context)
        NSGraphicsContext.restoreGraphicsState()
        return bitmap
    }
    NSColor.white.setFill()
    NSRect(x: 0, y: 0, width: canvas, height: canvas).fill()
    body(context)
    let frame = NSBezierPath(
        roundedRect: NSRect(x: 0, y: 0, width: canvas, height: canvas).insetBy(dx: frameInset, dy: frameInset),
        xRadius: frameRadius,
        yRadius: frameRadius
    )
    frame.lineWidth = frameWidth
    ink.setStroke()
    frame.stroke()
    NSGraphicsContext.restoreGraphicsState()
    return bitmap
}

func write(_ bitmap: NSBitmapImageRep, to path: String) {
    try! bitmap.representation(using: .png, properties: [:])!.write(to: root.appendingPathComponent(path))
    print("Wrote \(path) (\(Int(canvas)) px)")
}

let qrBitmap = render { $0.draw(code, in: CGRect(x: margin, y: margin, width: size, height: size)) }
let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
let decoded = detector.features(in: CIImage(cgImage: qrBitmap.cgImage!)).compactMap { ($0 as? CIQRCodeFeature)?.messageString }
guard decoded == [url] else {
    FileHandle.standardError.write("The seal QR code reads as \(decoded), not \(url); nothing written.\n".data(using: .utf8)!)
    exit(1)
}
write(qrBitmap, to: "assets/kaketa-qr-seal.png")

// The module grid: dark data modules, with the three corner markers and the small
// alignment marker kept apart, since those are drawn as shapes rather than dots.
let quiet = 1  // the plain generator pads one module on each side
let modules = gridPixels - quiet * 2
let alignment = modules - 7  // the alignment marker's center in this code version
func isDark(_ column: Int, _ row: Int) -> Bool { grid[(row * gridPixels + column) * 4] < 128 }
func isMarker(_ column: Int, _ row: Int) -> Bool {
    let (x, y) = (column - quiet, row - quiet)
    let corner = (x < 8 && y < 8) || (x >= modules - 8 && y < 8) || (x < 8 && y >= modules - 8)
    return corner || (abs(x - alignment) <= 2 && abs(y - alignment) <= 2)
}
var ends: [CGPoint] = []
for row in 0..<gridPixels {
    for column in 0..<gridPixels where isDark(column, row) && !isMarker(column, row) {
        ends.append(CGPoint(x: margin + (CGFloat(column) + 0.5) * pitch, y: margin + (CGFloat(row) + 0.5) * pitch))
    }
}
let markers = [(0, 0, 7), (modules - 7, 0, 7), (0, modules - 7, 7), (alignment - 2, alignment - 2, 5)].map { column, row, width in
    [margin + CGFloat(column + quiet) * pitch, margin + CGFloat(row + quiet) * pitch, CGFloat(width) * pitch]
}

// Pair starts with ends so the total distance is as small as possible (the Hungarian
// algorithm): straight paths paired that way never cross, so the dots spread out
// calmly instead of crisscrossing. Starts go in Hilbert-curve order, which the page
// uses to stagger departures, so neighbors leave together.
func hilbert(_ point: CGPoint, order: Int = 64) -> Int {
    var x = max(0, min(order - 1, Int(point.x / canvas * CGFloat(order))))
    var y = max(0, min(order - 1, Int(point.y / canvas * CGFloat(order))))
    var distance = 0, s = order / 2
    while s > 0 {
        let rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0
        distance += s * s * ((3 * rx) ^ ry)
        if ry == 0 {
            if rx == 1 { x = s - 1 - x; y = s - 1 - y }
            swap(&x, &y)
        }
        s /= 2
    }
    return distance
}
func minimumDistancePairing(_ a: [CGPoint], _ b: [CGPoint]) -> [Int] {
    let n = a.count
    var u = [Double](repeating: 0, count: n + 1), v = [Double](repeating: 0, count: n + 1)
    var p = [Int](repeating: 0, count: n + 1), way = [Int](repeating: 0, count: n + 1)
    func cost(_ i: Int, _ j: Int) -> Double { Double(hypot(a[i - 1].x - b[j - 1].x, a[i - 1].y - b[j - 1].y)) }
    for i in 1...n {
        p[0] = i
        var j0 = 0
        var minimum = [Double](repeating: .infinity, count: n + 1)
        var used = [Bool](repeating: false, count: n + 1)
        repeat {
            used[j0] = true
            let i0 = p[j0]
            var delta = Double.infinity, j1 = 0
            for j in 1...n where !used[j] {
                let current = cost(i0, j) - u[i0] - v[j]
                if current < minimum[j] { minimum[j] = current; way[j] = j0 }
                if minimum[j] < delta { delta = minimum[j]; j1 = j }
            }
            for j in 0...n {
                if used[j] { u[p[j]] += delta; v[j] -= delta } else { minimum[j] -= delta }
            }
            j0 = j1
        } while p[j0] != 0
        repeat { let j1 = way[j0]; p[j0] = p[j1]; j0 = j1 } while j0 != 0
    }
    var match = [Int](repeating: 0, count: n)
    for j in 1...n { match[p[j] - 1] = j - 1 }
    return match  // a[i] pairs with b[match[i]]
}
let rounding = { (value: CGFloat) in (Double(value) * 10).rounded() / 10 }
let squareSide = canvas - frameInset * 2

// One seal: its lettering in one column in a frame as tall as the code's square one
// and `widthRatio` as wide, centered. The page widens that frame into the square.
//   text           the lettering, top to bottom
//   name           the lettering image, on transparent: the page draws the frame
//   json           the dots, markers and frames for the page
//   sampleStep     how finely to sample the lettering for dot positions, in pixels
//   extraSpacing   how far apart extra dots are, in modules; smaller traces more detail
//   startScale     how big the dots start, relative to a module, so they trace thin
//                  strokes and grow on the way
func seal(text: String, widthRatio: CGFloat, name: String, json: String, sampleStep: Int, extraSpacing: CGFloat, startScale: Double) {
    let nameFrame = CGRect(x: (canvas - squareSide * widthRatio) / 2, y: frameInset, width: squareSide * widthRatio, height: squareSide)
    func drawName(_ context: CGContext, color: NSColor) {
        let column = Array(text)
        let inner = nameFrame.insetBy(dx: frameWidth, dy: frameWidth)
        let usableWidth = inner.width * 0.72, usableHeight = inner.height * 0.80
        let step = usableHeight / CGFloat(column.count)
        let fontSize = min(step * 1.12, usableWidth * 0.95)
        // Seal lettering is stretched to fill its column; katakana are narrow otherwise.
        let stretch = min(usableWidth * 0.92 / fontSize, 1.6)
        for (index, character) in column.enumerated() {
            let y = canvas / 2 + usableHeight / 2 - step * (CGFloat(index) + 0.5)
            let line = CTLineCreateWithAttributedString(NSAttributedString(
                string: String(character),
                attributes: [.font: NSFont(name: fontName, size: fontSize)!, .foregroundColor: color]
            ))
            let bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
            context.saveGState()
            context.translateBy(x: canvas / 2, y: y)
            context.scaleBy(x: stretch, y: 1)
            context.textPosition = CGPoint(x: -bounds.midX, y: -bounds.midY)
            CTLineDraw(line, context)
            context.restoreGState()
        }
    }
    write(render(framed: false) { drawName($0, color: ink) }, to: name)

    // Sample the lettering: rasterize it, then keep evenly spread points on the ink.
    let maskSize = Int(canvas)
    var mask = [UInt8](repeating: 0, count: maskSize * maskSize)
    let maskContext = CGContext(
        data: &mask, width: maskSize, height: maskSize, bitsPerComponent: 8, bytesPerRow: maskSize,
        space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue
    )!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: maskContext, flipped: false)
    drawName(maskContext, color: .white)
    NSGraphicsContext.restoreGraphicsState()
    var inkPoints: [CGPoint] = []
    for y in stride(from: 0, to: maskSize, by: sampleStep) {
        for x in stride(from: 0, to: maskSize, by: sampleStep) where mask[y * maskSize + x] > 128 {
            // The context's memory starts with the top row, so y is already top-down.
            inkPoints.append(CGPoint(x: CGFloat(x), y: CGFloat(y)))
        }
    }
    // A fixed shuffle, so the output is the same every run.
    var seed: UInt64 = 42
    func nextRandom() -> UInt64 { seed = seed &* 6364136223846793005 &+ 1442695040888963407; return seed >> 33 }
    for i in stride(from: inkPoints.count - 1, to: 0, by: -1) { inkPoints.swapAt(i, Int(nextRandom() % UInt64(i + 1))) }
    // Keep points that aren't too close to one already kept, relaxing the spacing
    // until there's one for every data dot.
    var spacing = pitch * 1.2
    var starts: [CGPoint] = []
    while spacing > 1 {
        starts = []
        for point in inkPoints where starts.allSatisfy({ hypot($0.x - point.x, $0.y - point.y) >= spacing }) {
            starts.append(point)
            if starts.count == ends.count { break }
        }
        if starts.count == ends.count { break }
        spacing *= 0.92
    }
    guard starts.count == ends.count else { fatalError("Couldn't place \(ends.count) points on \(text)") }
    starts.sort { hilbert($0) < hilbert($1) }
    let match = minimumDistancePairing(starts, ends)

    // Extra dots so the dotted lettering reads like the lettering. Each follows its
    // nearest real dot and fades out as it arrives, so the finished code still has
    // exactly its own dots.
    var placed = starts
    var extras: [[Double]] = []
    for point in inkPoints where placed.allSatisfy({ hypot($0.x - point.x, $0.y - point.y) >= pitch * extraSpacing }) {
        placed.append(point)
        let nearest = starts.indices.min { hypot(starts[$0].x - point.x, starts[$0].y - point.y) < hypot(starts[$1].x - point.x, starts[$1].y - point.y) }!
        extras.append([Double(point.x), Double(point.y), Double(nearest)])
    }

    let dots = starts.enumerated().map { index, start in
        [start.x, start.y, ends[match[index]].x, ends[match[index]].y].map(rounding)
    }
    let data: [String: Any] = [
        "canvas": rounding(canvas),
        "pitch": rounding(pitch),
        "frame": [rounding(frameInset), rounding(frameWidth), rounding(frameRadius)],
        "nameFrame": [nameFrame.minX, nameFrame.minY, nameFrame.width, nameFrame.height].map(rounding),  // x, y, width, height
        "startScale": startScale,
        "markers": markers.map { $0.map(rounding) },
        "dots": dots,  // [startX, startY, endX, endY], in canvas pixels, y down
        "extras": extras.map { [rounding($0[0]), rounding($0[1]), $0[2]] },  // [startX, startY, index of the dot it follows]
    ]
    try! JSONSerialization.data(withJSONObject: data).write(to: root.appendingPathComponent(json))
    print("Wrote \(json) (\(dots.count) dots, \(extras.count) extras)")
}

// 書いて覚える, the tagline. Its kanji are dense, so they're sampled finely with small
// dots to stay legible.
seal(text: "書いて覚える", widthRatio: 0.3, name: "assets/kaketa-qr-seal-name.png", json: "assets/kaketa-qr-seal.json", sampleStep: 2, extraSpacing: 0.19, startScale: 0.3)
