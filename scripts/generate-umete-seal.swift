// Generates the tagline seal on the Umete home page:
//   assets/umete-seal-tagline.png        47 × 112 points at 3×, stamped beside the hero
//   assets/umete-seal-tagline-large.png  118 × 283 points at 3×, for the /hanko page
//
//   swift scripts/generate-umete-seal.swift
//
// 空欄を埋めて, "fill in the blanks", in a single column, in the proportions and ink of
// Karui's 通知をかるく. Karui's seals are scans of stamps carved by hand; this one is drawn
// to look carved. The lettering is a brush-built textbook hand (Yu Kyokasho) widened to
// fill the frame, as seal lettering is, then cut into straight facets like knife cuts,
// each character turned and nudged a little, inside a frame whose edges wander. Then it
// is inked like a pressed stamp: edges that wobble, pinholes where the paper didn't take
// the ink, a fine grain, and uneven pressure.
//
// Everything random comes from the seeds below, so running the script again draws the
// same seal.
import Accelerate
import AppKit
import CoreText

let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
let text = Array("空欄を埋めて")
let fontName = "YuKyo-Bold"
// Crowded characters are cut with thinner strokes so their counters stay open.
let crowded: Set<Character> = ["欄"]
let thinFontName = "YuKyo-Medium"
// Extra stroke around each character, and the size of a facet, as fractions of the
// character's size.
let weight: CGFloat = 0.06, thinWeight: CGFloat = 0.028, facet: CGFloat = 0.022
// Karui's ink, sampled from its scan after deepening.
let ink: (red: Double, green: Double, blue: Double) = (187, 39, 57)
// Drawn at three times the large seal's pixels, so the carving and the ink's grain are
// finer than either size shows.
let width = 1062, height = 2547
let W = CGFloat(width), H = CGFloat(height)

// MARK: The carving, as a mask: black ink on white.

var carvingSeed: UInt64 = 11
func wander() -> CGFloat {  // -1 ... 1
    carvingSeed = carvingSeed &* 6364136223846793005 &+ 1442695040888963407
    return CGFloat((carvingSeed >> 33) % 20001) / 10000 - 1
}

let carving = CGContext(
    data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width,
    space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue
)!
carving.setFillColor(gray: 1, alpha: 1)
carving.fill(CGRect(x: 0, y: 0, width: W, height: H))
carving.setFillColor(gray: 0, alpha: 1)
carving.setStrokeColor(gray: 0, alpha: 1)

// The frame: the band between two rectangles whose sides wander.
func wanderingRect(_ rect: CGRect, step: CGFloat, by amount: CGFloat) -> [CGPoint] {
    var points: [CGPoint] = []
    func side(_ a: CGPoint, _ b: CGPoint) {
        let count = max(2, Int((hypot(b.x - a.x, b.y - a.y) / step).rounded()))
        for i in 0..<count {
            let t = CGFloat(i) / CGFloat(count)
            // Corners wander less than the sides between them.
            let reach = i == 0 ? amount * 0.4 : amount
            points.append(CGPoint(x: a.x + (b.x - a.x) * t + wander() * reach, y: a.y + (b.y - a.y) * t + wander() * reach))
        }
    }
    side(CGPoint(x: rect.minX, y: rect.minY), CGPoint(x: rect.maxX, y: rect.minY))
    side(CGPoint(x: rect.maxX, y: rect.minY), CGPoint(x: rect.maxX, y: rect.maxY))
    side(CGPoint(x: rect.maxX, y: rect.maxY), CGPoint(x: rect.minX, y: rect.maxY))
    side(CGPoint(x: rect.minX, y: rect.maxY), CGPoint(x: rect.minX, y: rect.minY))
    return points
}
let margin: CGFloat = 10, band: CGFloat = 42
let frame = CGMutablePath()
frame.addLines(between: wanderingRect(CGRect(x: margin, y: margin, width: W - margin * 2, height: H - margin * 2), step: 150, by: 9))
frame.closeSubpath()
frame.addLines(between: wanderingRect(
    CGRect(x: margin + band, y: margin + band, width: W - (margin + band) * 2, height: H - (margin + band) * 2), step: 120, by: 12
))
frame.closeSubpath()
carving.addPath(frame)
carving.fillPath(using: .evenOdd)

// Drops the points that lie close to the line between their neighbours, so a curve is
// left as a few straight cuts.
func simplified(_ points: [CGPoint], within tolerance: CGFloat) -> [CGPoint] {
    guard points.count > 2 else { return points }
    let a = points.first!, b = points.last!
    let length = max(hypot(b.x - a.x, b.y - a.y), 0.0001)
    var farthest = 0, distance: CGFloat = 0
    for i in 1..<(points.count - 1) {
        let d = abs((b.x - a.x) * (a.y - points[i].y) - (a.x - points[i].x) * (b.y - a.y)) / length
        if d > distance { distance = d; farthest = i }
    }
    if distance <= tolerance { return [a, b] }
    return simplified(Array(points[0...farthest]), within: tolerance).dropLast() + simplified(Array(points[farthest...]), within: tolerance)
}

// A glyph's outline as straight cuts, each corner nudged.
func carved(_ outline: CGPath, tolerance: CGFloat, nudge: CGFloat) -> CGPath {
    var rings: [[CGPoint]] = [], ring: [CGPoint] = []
    outline.applyWithBlock { pointer in
        let element = pointer.pointee, p = element.points
        let from = ring.last ?? .zero
        switch element.type {
        case .moveToPoint:
            if ring.count > 2 { rings.append(ring) }
            ring = [p[0]]
        case .addLineToPoint:
            ring.append(p[0])
        case .addQuadCurveToPoint:
            for t in [CGFloat(0.25), 0.5, 0.75, 1] {
                let u = 1 - t
                ring.append(CGPoint(x: u * u * from.x + 2 * u * t * p[0].x + t * t * p[1].x, y: u * u * from.y + 2 * u * t * p[0].y + t * t * p[1].y))
            }
        case .addCurveToPoint:
            for t in [CGFloat(0.2), 0.4, 0.6, 0.8, 1] {
                let u = 1 - t
                ring.append(CGPoint(
                    x: u * u * u * from.x + 3 * u * u * t * p[0].x + 3 * u * t * t * p[1].x + t * t * t * p[2].x,
                    y: u * u * u * from.y + 3 * u * u * t * p[0].y + 3 * u * t * t * p[1].y + t * t * t * p[2].y
                ))
            }
        case .closeSubpath:
            if ring.count > 2 { rings.append(ring) }
            ring = []
        @unknown default:
            break
        }
    }
    if ring.count > 2 { rings.append(ring) }
    let cut = CGMutablePath()
    for ring in rings {
        // A closed ring starts and ends at one point, which gives the simplifier no line
        // to measure from: split it at the point farthest from the start, and do each half.
        var farthest = 0, distance: CGFloat = 0
        for (i, point) in ring.enumerated() {
            let d = hypot(point.x - ring[0].x, point.y - ring[0].y)
            if d > distance { distance = d; farthest = i }
        }
        guard farthest > 0 else { continue }
        var corners = Array(simplified(Array(ring[0...farthest]), within: tolerance).dropLast())
            + simplified(Array(ring[farthest...]) + [ring[0]], within: tolerance)
        corners.removeLast()
        guard corners.count > 2 else { continue }
        cut.addLines(between: corners.map { CGPoint(x: $0.x + wander() * nudge, y: $0.y + wander() * nudge) })
        cut.closeSubpath()
    }
    return cut
}

// One column, top to bottom. Kana are cut smaller than kanji, as carvers do.
let inset = margin + band + W * 0.05
let usableWidth = W - inset * 2, usableHeight = H - (margin + band + H * 0.028) * 2
let isKana: (Character) -> Bool = { ("ぁ"..."ゟ").contains($0) || ("゠"..."ヿ").contains($0) }
let shares: [CGFloat] = text.map { isKana($0) ? 0.8 : 1 }
let unit = usableHeight / shares.reduce(0, +)
var top = H - (H - usableHeight) / 2
for (index, character) in text.enumerated() {
    let slot = unit * shares[index], kana = shares[index] < 1
    let size = min(slot * 0.98, usableWidth) * (kana ? 0.97 : 1)
    let thin = crowded.contains(character)
    let font = CTFontCreateWithName((thin ? thinFontName : fontName) as CFString, size, nil)
    guard (CTFontCopyPostScriptName(font) as String) == (thin ? thinFontName : fontName) else {
        fatalError("\(thin ? thinFontName : fontName) isn't installed; it comes with macOS (Yu Kyokasho).")
    }
    var characters = Array(String(character).utf16), glyphs = [CGGlyph](repeating: 0, count: characters.count)
    guard CTFontGetGlyphsForCharacters(font, &characters, &glyphs, characters.count),
          let outline = CTFontCreatePathForGlyph(font, glyphs[0], nil) else { fatalError("No glyph for \(character)") }
    let box = outline.boundingBoxOfPath
    // Widened to fill the column without squashing it out of shape.
    let stretchX = min(usableWidth * (kana ? 0.8 : 0.97) / box.width, 2.1), stretchY = min(slot * 0.9 / box.height, 1.15)
    var placement = CGAffineTransform(translationX: W / 2 + wander() * W * 0.012, y: top - slot / 2 + wander() * slot * 0.015)
    placement = placement.rotated(by: wander() * 0.05).scaledBy(x: stretchX, y: stretchY).translatedBy(x: -box.midX, y: -box.midY)
    carving.addPath(carved(outline.copy(using: &placement)!, tolerance: size * facet, nudge: size * 0.007))
    carving.setLineWidth(size * (thin ? thinWeight : weight))
    carving.setLineJoin(.miter)
    carving.setMiterLimit(3)
    carving.drawPath(using: .fillStroke)
    top -= slot
}

// MARK: The ink.

let count = width * height
// The mask as ink coverage, 255 where the stamp prints. The bitmap's rows run from the top.
var coverage = [UInt8](repeating: 0, count: count)
let carvedPixels = carving.data!.bindMemory(to: UInt8.self, capacity: count)
for i in 0..<count { coverage[i] = 255 - carvedPixels[i] }

var inkSeed: UInt64 = 0x5EA1
func nextRandom() -> UInt64 {  // SplitMix64
    inkSeed &+= 0x9E3779B97F4A7C15
    var z = inkSeed
    z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
    z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
    return z ^ (z >> 31)
}

// Three box blurs come close to a Gaussian of this standard deviation.
func blurred(_ pixels: [UInt8], sigma: Double, passes: Int = 3) -> [UInt8] {
    var kernel = max(3, Int((4 * sigma * sigma + 1).squareRoot().rounded()))
    if kernel % 2 == 0 { kernel += 1 }
    var source = pixels, result = [UInt8](repeating: 0, count: pixels.count)
    for _ in 0..<passes {
        source.withUnsafeMutableBytes { from in
            result.withUnsafeMutableBytes { to in
                var input = vImage_Buffer(data: from.baseAddress, height: vImagePixelCount(height), width: vImagePixelCount(width), rowBytes: width)
                var output = vImage_Buffer(data: to.baseAddress, height: vImagePixelCount(height), width: vImagePixelCount(width), rowBytes: width)
                vImageBoxConvolve_Planar8(&input, &output, nil, 0, 0, UInt32(kernel), UInt32(kernel), 0, vImage_Flags(kvImageEdgeExtend))
            }
        }
        swap(&source, &result)
    }
    return source
}

// Noise blurred to a grain of the given size, as how far each pixel is from the mean in
// standard deviations, so the thresholds below don't depend on the blur.
func grainField(sigma: Double) -> [Float] {
    var noise = [UInt8](repeating: 0, count: count)
    var i = 0
    while i < count {
        var bits = nextRandom()
        for _ in 0..<min(8, count - i) { noise[i] = UInt8(truncatingIfNeeded: bits); bits >>= 8; i += 1 }
    }
    let soft = blurred(noise, sigma: sigma)
    var sum = 0.0, squares = 0.0
    for value in soft { sum += Double(value); squares += Double(value) * Double(value) }
    let mean = sum / Double(count), deviation = max((squares / Double(count) - mean * mean).squareRoot(), 0.001)
    return soft.map { Float((Double($0) - mean) / deviation) }
}

// Edges: soften the mask, push it in and out by a slow field, and cut it again.
let softened = blurred(coverage, sigma: 3.2)
let wobble = grainField(sigma: 4)
// Pinholes where the paper didn't take the ink.
let pinholes = grainField(sigma: 1.6)
var printed = [UInt8](repeating: 0, count: count)
for i in 0..<count where Float(softened[i]) + wobble[i] * 19 > 118 && pinholes[i] < 2.5 { printed[i] = 255 }
printed = blurred(printed, sigma: 0.8, passes: 1)

// Pressure: a little lighter here and there, from a coarse grid of pressures smoothed
// across the seal.
let columns = 5, rows = 11
let pressures: [Double] = (0..<(columns * rows)).map { _ in 0.91 + 0.09 * Double(nextRandom() % 1000) / 999 }
func pressure(_ x: Int, _ y: Int) -> Double {
    let fx = Double(x) / Double(width - 1) * Double(columns - 1), fy = Double(y) / Double(height - 1) * Double(rows - 1)
    let x0 = min(Int(fx), columns - 2), y0 = min(Int(fy), rows - 2)
    let tx = fx - Double(x0), ty = fy - Double(y0)
    let smoothX = tx * tx * (3 - 2 * tx), smoothY = ty * ty * (3 - 2 * ty)
    let upper = pressures[y0 * columns + x0] * (1 - smoothX) + pressures[y0 * columns + x0 + 1] * smoothX
    let lower = pressures[(y0 + 1) * columns + x0] * (1 - smoothX) + pressures[(y0 + 1) * columns + x0 + 1] * smoothX
    return upper * (1 - smoothY) + lower * smoothY
}
// Grain: the mottle of ink on paper, finer than the pinholes.
let grain = grainField(sigma: 1.1)

var pixels = [UInt8](repeating: 255, count: count * 4)
for y in 0..<height {
    for x in 0..<width {
        let i = y * width + x
        guard printed[i] > 0 else { continue }
        let mottle = min(255, max(165, 250 + Double(grain[i]) * 34)) / 255
        let amount = Double(printed[i]) / 255 * pressure(x, y) * mottle
        pixels[i * 4] = UInt8((255 + (ink.red - 255) * amount).rounded())
        pixels[i * 4 + 1] = UInt8((255 + (ink.green - 255) * amount).rounded())
        pixels[i * 4 + 2] = UInt8((255 + (ink.blue - 255) * amount).rounded())
    }
}

// MARK: The two sizes. On white, which the ink-in animation needs on every side of the border.

let sRGB = CGColorSpace(name: CGColorSpace.sRGB)!
let seal = pixels.withUnsafeMutableBytes { bytes in
    CGContext(
        data: bytes.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
        space: sRGB, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!.makeImage()!
}

func write(pointWidth: Int, pointHeight: Int, scale: Int, to path: String) {
    let context = CGContext(
        data: nil, width: pointWidth * scale, height: pointHeight * scale, bitsPerComponent: 8, bytesPerRow: 0,
        space: sRGB, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    context.interpolationQuality = .high
    context.draw(seal, in: CGRect(x: 0, y: 0, width: pointWidth * scale, height: pointHeight * scale))
    let output = NSBitmapImageRep(cgImage: context.makeImage()!)
    try! output.representation(using: .png, properties: [:])!.write(to: root.appendingPathComponent(path))
    print("Wrote \(path): \(pointWidth) × \(pointHeight) points, \(pointWidth * scale) × \(pointHeight * scale) px")
}

// Stamped beside the hero the first time the page loads: Karui's size.
write(pointWidth: 47, pointHeight: 112, scale: 3, to: "assets/umete-seal-tagline.png")
// The same seal two and a half times as tall, for the /hanko page.
write(pointWidth: 118, pointHeight: 283, scale: 3, to: "assets/umete-seal-tagline-large.png")
