// Generates the tagline seal on the Kaketa home page, from Karui's generate-karui-seal.swift:
//   assets/kaketa-seal-tagline.png        26 × 112 points at 3×, stamped beside the hero
//   assets/kaketa-seal-tagline-large.png  66 × 283 points at 3×, for the /hanko page
//
//   swift scripts/generate-kaketa-seal.swift
//
// 書いて覚える in a single column, in Kaketa's vermilion: red lettering in a red border
// on white (朱文). The footer's name seal is the one Karui's page uses.
import AppKit
import CoreText

// Columns read right to left, so with a first name it would be
// ["ジャスティン", "ガルシア"] and the seal twice as wide.
let nameColumns = ["ガルシア"]
let fontName = "ToppanBunkyuMidashiMinchoStdN-ExtraBold"
let ink = NSColor(srgbRed: 0.78, green: 0.26, blue: 0.17, alpha: 1)  // Kaketa's vermilion, the correction pen
let outlined = true
let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()

// Sizes are in points; `scale` turns them into pixels.
func renderSeal(
    _ columnTexts: [String],
    pointWidth: CGFloat,
    pointHeight: CGFloat,
    scale: CGFloat,
    borderPoints: CGFloat,
    radiusPoints: CGFloat,
    // Extra space between characters, as a fraction of each one's slot.
    spacing: CGFloat = 0,
    to path: String
) {
    let columns = columnTexts.map(Array.init)
    let width = pointWidth * scale, height = pointHeight * scale
    let radius = radiusPoints * scale, borderWidth = borderPoints * scale
    let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: Int(width), pixelsHigh: Int(height),
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    )!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    let context = NSGraphicsContext.current!.cgContext
    context.clear(CGRect(x: 0, y: 0, width: width, height: height))
    let bounds = NSRect(x: 0, y: 0, width: width, height: height)
    if outlined {
        NSColor.white.setFill()
        NSBezierPath(roundedRect: bounds, xRadius: radius, yRadius: radius).fill()
        // The stroke is centered on its path, so inset by half its width to keep the
        // outer edge and corners the same as the solid version.
        let border = NSBezierPath(
            roundedRect: bounds.insetBy(dx: borderWidth / 2, dy: borderWidth / 2),
            xRadius: radius - borderWidth / 2,
            yRadius: radius - borderWidth / 2
        )
        border.lineWidth = borderWidth
        ink.setStroke()
        border.stroke()
    } else {
        ink.setFill()
        NSBezierPath(roundedRect: bounds, xRadius: radius, yRadius: radius).fill()
    }
    let letterColor = outlined ? ink : NSColor.white

    func draw(_ character: Character, fontSize: CGFloat, center: CGPoint, stretch: CGFloat) {
        let font = NSFont(name: fontName, size: fontSize)!
        let line = CTLineCreateWithAttributedString(NSAttributedString(
            string: String(character),
            attributes: [.font: font, .foregroundColor: letterColor]
        ))
        let glyphBounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
        context.saveGState()
        context.translateBy(x: center.x, y: center.y)
        context.scaleBy(x: stretch, y: 1)
        context.textPosition = CGPoint(x: -glyphBounds.midX, y: -glyphBounds.midY)
        CTLineDraw(line, context)
        context.restoreGState()
    }

    // Keep the lettering clear of the border, however thick it is.
    let usableHeight = height * (outlined ? 0.80 : 0.84)
    let usableWidth = min(width * (outlined ? 0.72 : 0.76), (width - borderWidth * 2) * 0.86)
    let columnWidth = usableWidth / CGFloat(columns.count)
    for (columnIndex, column) in columns.enumerated() {
        let x = width / 2 + usableWidth / 2 - columnWidth * (CGFloat(columnIndex) + 0.5)
        let step = usableHeight / CGFloat(column.count)
        let fontSize = min(step * (1.12 - spacing), columnWidth * 0.95)
        // Seal lettering is stretched to fill its column; katakana are narrow otherwise.
        let stretch = min(columnWidth * 0.92 / fontSize, 1.6)
        for (index, character) in column.enumerated() {
            let y = height / 2 + usableHeight / 2 - step * (CGFloat(index) + 0.5)
            // In vertical Japanese, small kana like ャ and ィ sit toward the top right.
            let isSmall = "ァィゥェォャュョッ".contains(character)
            let nudge = isSmall ? CGPoint(x: columnWidth * 0.14, y: step * 0.16) : .zero
            draw(character, fontSize: fontSize, center: CGPoint(x: x + nudge.x, y: y + nudge.y), stretch: stretch)
        }
    }
    NSGraphicsContext.restoreGraphicsState()
    let outputURL = root.appendingPathComponent(path)
    try! bitmap.representation(using: .png, properties: [:])!.write(to: outputURL)
    print("Wrote \(outputURL.path) (\(Int(width)) × \(Int(height)) px)")
}

// 書いて覚える, the tagline, stamped beside the hero the first time the page loads.
// Five dense characters need room between them; just wide enough that the lettering
// keeps its own proportions.
renderSeal(["書いて覚える"], pointWidth: 26, pointHeight: 112, scale: 3, borderPoints: 2, radiusPoints: 4, spacing: 0.16, to: "assets/kaketa-seal-tagline.png")
// The same seal two and a half times as tall, for the /hanko page.
renderSeal(["書いて覚える"], pointWidth: 66, pointHeight: 283, scale: 3, borderPoints: 5, radiusPoints: 10, spacing: 0.16, to: "assets/kaketa-seal-tagline-large.png")
