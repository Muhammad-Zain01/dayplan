import AppKit
import Foundation

guard CommandLine.arguments.count == 2 else {
    fputs("Usage: GenerateAppIcon.swift <output.png>\n", stderr)
    exit(EXIT_FAILURE)
}

let outputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let canvasSize = NSSize(width: 1024, height: 1024)
let image = NSImage(size: canvasSize)
image.lockFocus()

let canvas = NSRect(origin: .zero, size: canvasSize)
NSColor(calibratedRed: 0.12, green: 0.16, blue: 0.27, alpha: 1).setFill()
NSBezierPath(roundedRect: canvas.insetBy(dx: 24, dy: 24), xRadius: 218, yRadius: 218).fill()

let sheet = NSBezierPath(roundedRect: NSRect(x: 220, y: 150, width: 584, height: 704), xRadius: 76, yRadius: 76)
NSColor(calibratedRed: 0.96, green: 0.97, blue: 1, alpha: 1).setFill()
sheet.fill()

let check = NSBezierPath()
check.lineWidth = 58
check.lineCapStyle = .round
check.lineJoinStyle = .round
check.move(to: NSPoint(x: 352, y: 494))
check.line(to: NSPoint(x: 454, y: 394))
check.line(to: NSPoint(x: 666, y: 606))
NSColor(calibratedRed: 0.26, green: 0.59, blue: 0.91, alpha: 1).setStroke()
check.stroke()

for y in [290.0, 726.0] {
    let line = NSBezierPath(roundedRect: NSRect(x: 350, y: y, width: 324, height: 22), xRadius: 11, yRadius: 11)
    NSColor(calibratedRed: 0.77, green: 0.80, blue: 0.88, alpha: 1).setFill()
    line.fill()
}

image.unlockFocus()

guard let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let pngData = bitmap.representation(using: .png, properties: [:]) else {
    fputs("Could not render DayPlan app icon.\n", stderr)
    exit(EXIT_FAILURE)
}

do {
    try pngData.write(to: outputURL, options: .atomic)
} catch {
    fputs("Could not write DayPlan app icon: \(error)\n", stderr)
    exit(EXIT_FAILURE)
}
