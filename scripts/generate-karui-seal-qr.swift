// Generates the animated seals at karui.jp/#qr, where a seal's lettering, in a
// narrow frame, turns into a QR code for karui.jp. There are two: 通知をかるく, the
// App Store name's tagline, and ガルシア, the footer seal, both from the scans of
// hand-carved stamps in scripts/karui-seal-scans.
//   assets/karui-qr-seal.png       the plain red QR code in a square frame, where
//                                  both end
//   assets/karui-qr-seal-tagline-name.png, assets/karui-qr-seal-name.png
//                                  each stamp, border and all, in the code's red on
//                                  transparent; the page fades its own frame in over
//                                  the stamp's border so it can widen
//   assets/karui-qr-seal-tagline.json, assets/karui-qr-seal.json
//                                  each data dot's start (on the lettering) and end
//                                  (its QR module), extra dots that fill out the
//                                  lettering, the markers, and both frames
//
//   swift scripts/generate-karui-seal-qr.swift
//
// The page animates the dots from one to the other, then shows the QR image, so
// what people scan is exactly this file. The script decodes it and fails if it
// doesn't read back as the URL, so a broken code never gets written.
import AppKit
import CoreImage

let url = "https://karui.jp/"
let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
let ink = NSColor(srgbRed: 0.80, green: 0.13, blue: 0.10, alpha: 1)  // shuiro, vermilion
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
rounded.setValue(CIColor(red: 0.80, green: 0.13, blue: 0.10), forKey: "inputColor1")
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
write(qrBitmap, to: "assets/karui-qr-seal.png")

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

// A stamp from its scan, cropped to its border, as two masks in the scan's pixels,
// top row first: all its ink, and its lettering alone, with the border erased.
struct Stamp {
    let ink: CGImage
    let lettering: CGImage
    var aspect: CGFloat { CGFloat(ink.width) / CGFloat(ink.height) }
}

func loadStamp(_ path: String) -> Stamp {
    let image = NSImage(contentsOf: root.appendingPathComponent(path))!.cgImage(forProposedRect: nil, context: nil, hints: nil)!
    let width = image.width, height = image.height
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    let context = CGContext(
        data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    // The ink is red on transparent paper, so how much redder than green a pixel is,
    // premultiplied, says how much ink covers it; the gray at the paper's edges has none.
    func coverage(_ x: Int, _ y: Int) -> UInt8 {
        let i = (y * width + x) * 4
        return UInt8(max(0, min(255, (Int(pixels[i]) - Int(pixels[i + 1])) * 255 / 110)))
    }
    // The border runs the length of every row and column inside it, so a row or column
    // with ink across more than a tenth of it is inside; specks outside never are.
    let rows = (0..<height).filter { y in (0..<width).filter { coverage($0, y) > 128 }.count > width / 10 }
    let columns = (0..<width).filter { x in (0..<height).filter { coverage(x, $0) > 128 }.count > height / 10 }
    let (left, top, right, bottom) = (columns.first!, rows.first!, columns.last!, rows.last!)
    // How thick the border is: the median run of ink in from each edge, over the middle
    // of that edge, where the lettering doesn't reach it.
    func median(_ runs: [Int]) -> Int { runs.sorted()[runs.count / 2] }
    func run(from start: Int, step: Int, at: (Int) -> UInt8) -> Int {
        var length = 0
        while length < 200, at(start + length * step) > 128 { length += 1 }
        return length
    }
    let middleRows = Array(stride(from: top + (bottom - top) / 5, to: bottom - (bottom - top) / 5, by: 2))
    let middleColumns = Array(stride(from: left + (right - left) / 5, to: right - (right - left) / 5, by: 2))
    // Erase a little past the median, since the carved border's inner edge wanders.
    let band = { (runs: [Int]) in Int(Double(median(runs)) * 1.5) + 2 }
    let leftBand = band(middleRows.map { y in run(from: left, step: 1) { coverage($0, y) } })
    let rightBand = band(middleRows.map { y in run(from: right, step: -1) { coverage($0, y) } })
    let topBand = band(middleColumns.map { x in run(from: top, step: 1) { coverage(x, $0) } })
    let bottomBand = band(middleColumns.map { x in run(from: bottom, step: -1) { coverage(x, $0) } })

    func mask(_ keep: (Int, Int) -> Bool) -> CGImage {
        let maskWidth = right - left + 1, maskHeight = bottom - top + 1
        var values = [UInt8](repeating: 0, count: maskWidth * maskHeight)
        for y in 0..<maskHeight {
            for x in 0..<maskWidth where keep(x, y) { values[y * maskWidth + x] = coverage(left + x, top + y) }
        }
        let context = CGContext(
            data: &values, width: maskWidth, height: maskHeight, bitsPerComponent: 8, bytesPerRow: maskWidth,
            space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue
        )!
        return context.makeImage()!
    }
    let maskWidth = right - left + 1, maskHeight = bottom - top + 1
    return Stamp(
        ink: mask { _, _ in true },
        lettering: mask { x, y in x >= leftBand && x < maskWidth - rightBand && y >= topBand && y < maskHeight - bottomBand }
    )
}

// One seal: its stamp in a frame as tall as the code's square one, and as wide as the
// stamp's proportions make it, centered. The page widens that frame into the square.
//   stamp          the scan, in scripts/karui-seal-scans
//   name           the stamp image, on transparent: the page draws the frame
//   json           the dots, markers and frames for the page
//   sampleStep     how finely to sample the lettering for dot positions, in pixels
//   extraSpacing   how far apart extra dots are, in modules; smaller traces more detail
//   startScale     how big the dots start, relative to a module, so they trace thin
//                  strokes and grow on the way
func seal(stamp path: String, name: String, json: String, sampleStep: Int, extraSpacing: CGFloat, startScale: Double) {
    let stamp = loadStamp(path)
    let nameFrame = CGRect(x: (canvas - squareSide * stamp.aspect) / 2, y: frameInset, width: squareSide * stamp.aspect, height: squareSide)
    // The page's frame is centered on nameFrame, so the stamp's border fills the same
    // band when the page fades from one to the other.
    let stampRect = nameFrame.insetBy(dx: -frameWidth / 2, dy: -frameWidth / 2)
    func draw(_ mask: CGImage, in context: CGContext, color: NSColor) {
        context.saveGState()
        context.interpolationQuality = .high
        context.clip(to: stampRect, mask: mask)
        context.setFillColor(color.cgColor)
        context.fill(stampRect)
        context.restoreGState()
    }
    write(render(framed: false) { draw(stamp.ink, in: $0, color: ink) }, to: name)

    // Sample the lettering, without the border, which becomes the frame: rasterize it,
    // then keep evenly spread points on the ink.
    let maskSize = Int(canvas)
    var mask = [UInt8](repeating: 0, count: maskSize * maskSize)
    let maskContext = CGContext(
        data: &mask, width: maskSize, height: maskSize, bitsPerComponent: 8, bytesPerRow: maskSize,
        space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue
    )!
    draw(stamp.lettering, in: maskContext, color: .white)
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
    guard starts.count == ends.count else { fatalError("Couldn't place \(ends.count) points on \(path)") }
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

// The carved strokes are thick, so the dots can start fairly large and spread out,
// which keeps the number of extras the page animates down, about 1,000 and 500.
// 通知をかるく, the App Store name's tagline, first. Its six characters are small, and the
// kanji dense, so they're sampled more finely with smaller dots to stay legible.
seal(stamp: "scripts/karui-seal-scans/tsuchi-wo-karuku.png", name: "assets/karui-qr-seal-tagline-name.png", json: "assets/karui-qr-seal-tagline.json", sampleStep: 2, extraSpacing: 0.32, startScale: 0.5)
// ガルシア, the footer seal.
seal(stamp: "scripts/karui-seal-scans/garcia.png", name: "assets/karui-qr-seal-name.png", json: "assets/karui-qr-seal.json", sampleStep: 3, extraSpacing: 0.38, startScale: 0.6)
