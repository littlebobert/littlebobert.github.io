// Generates the decorative seals on the Karui home page:
//   assets/karui-seal.png          24 × 51 points at 4×, beside the footer photo
//   assets/karui-seal-large.png    96 × 204 points at 3×, for the #seal view
//   assets/karui-seal-tagline.png        26 × 112 points at 3×, stamped beside the hero
//   assets/karui-seal-tagline-large.png  66 × 283 points at 3×, for the #tagline view
//
//   swift scripts/generate-karui-seal.swift
//
// ガルシア in a single column, like an everyday surname seal (認印), in
// vermilion like a seal impression: red lettering in a red border on white (朱文),
// or set `outlined` to false for white lettering on solid red (白文). It's a new
// design, not a copy of a registered seal. It's as tall as the 40 × 51-point
// footer photo, with the same 5-point corners.
import AppKit
import CoreText

// Columns read right to left, so with a first name it would be
// ["ジャスティン", "ガルシア"] and the seal twice as wide.
let nameColumns = ["ガルシア"]
let fontName = "ToppanBunkyuMidashiMinchoStdN-ExtraBold"
let ink = NSColor(srgbRed: 0.80, green: 0.13, blue: 0.10, alpha: 1)  // shuiro, vermilion
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

// A thin line looks lighter small than large, so the footer seal gets a heavier
// border than a straight scale-down of the large one would give it.
// 5-point corners, like the footer photo beside it.
renderSeal(nameColumns, pointWidth: 24, pointHeight: 51, scale: 4, borderPoints: 2.5, radiusPoints: 5, to: "assets/karui-seal.png")
// 4× the footer size in points, at 3× for sharp phone screens.
// Shown four times as big, where a full-size radius looked too round.
renderSeal(nameColumns, pointWidth: 96, pointHeight: 204, scale: 3, borderPoints: 1.6 * 4, radiusPoints: 3.5 * 4, to: "assets/karui-seal-large.png")
// 通知を軽く, the App Store name's tagline, stamped beside the hero the first time the
// page loads. Five dense kanji need more room between them than ガルシア's kana.
// Just wide enough that the lettering keeps its own proportions: any wider and it is
// stretched to fill the column, which makes kanji look squat.
renderSeal(["通知を軽く"], pointWidth: 26, pointHeight: 112, scale: 3, borderPoints: 2, radiusPoints: 4, spacing: 0.16, to: "assets/karui-seal-tagline.png")
// The same seal two and a half times as tall, for the #tagline view.
renderSeal(["通知を軽く"], pointWidth: 66, pointHeight: 283, scale: 3, borderPoints: 5, radiusPoints: 10, spacing: 0.16, to: "assets/karui-seal-tagline-large.png")
