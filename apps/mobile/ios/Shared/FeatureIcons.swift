import SwiftUI

// Match the 24-point line icons in SquatIcon.tsx and FlowerLiftIcon.tsx.
// Shared by the watch app, complications and iPhone Live Activity targets.

struct SquatIcon: View {
  var size: CGFloat = 24

  var body: some View {
    SquatShape()
      .stroke(style: StrokeStyle(lineWidth: size / 12, lineCap: .round, lineJoin: .round))
      .frame(width: size, height: size)
      .accessibilityHidden(true)
  }
}

private struct SquatShape: Shape {
  func path(in rect: CGRect) -> Path {
    var path = Path()
    path.addEllipse(in: CGRect(x: 11, y: 2.5, width: 4, height: 4))
    path.move(to: CGPoint(x: 10.5, y: 9))
    path.addCurve(to: CGPoint(x: 6.5, y: 15.5), control1: CGPoint(x: 9.8, y: 11.3), control2: CGPoint(x: 8, y: 13.8))
    path.addCurve(to: CGPoint(x: 7.9, y: 17.3), control1: CGPoint(x: 5.7, y: 16.5), control2: CGPoint(x: 6.6, y: 17.7))
    path.addLine(to: CGPoint(x: 15.1, y: 15.1))
    path.addCurve(to: CGPoint(x: 16.3, y: 16.9), control1: CGPoint(x: 16.2, y: 14.8), control2: CGPoint(x: 17, y: 16))
    path.addLine(to: CGPoint(x: 12.4, y: 21.8))
    path.move(to: CGPoint(x: 10.5, y: 9))
    path.addLine(to: CGPoint(x: 13.7, y: 12))
    path.addCurve(to: CGPoint(x: 15.2, y: 12.5), control1: CGPoint(x: 14.1, y: 12.4), control2: CGPoint(x: 14.6, y: 12.5))
    path.addLine(to: CGPoint(x: 20, y: 12.5))
    return path.applying(CGAffineTransform(scaleX: rect.width / 24, y: rect.height / 24))
  }
}

struct FlowerLiftIcon: View {
  var size: CGFloat = 24

  var body: some View {
    ZStack {
      FlowerShape()
        .stroke(style: StrokeStyle(lineWidth: size / 12, lineCap: .round, lineJoin: .round))
      Circle()
        .fill()
        .frame(width: size / 12, height: size / 12)
        .offset(y: -size * 3.4 / 24)
    }
      .frame(width: size, height: size)
      .accessibilityHidden(true)
  }
}

private struct FlowerShape: Shape {
  func path(in rect: CGRect) -> Path {
    var path = Path()
    path.move(to: CGPoint(x: 10, y: 5))
    path.addCurve(to: CGPoint(x: 14, y: 5), control1: CGPoint(x: 9.3, y: 1.3), control2: CGPoint(x: 14.7, y: 1.3))
    path.addCurve(to: CGPoint(x: 16.4, y: 8.6), control1: CGPoint(x: 16.9, y: 2.5), control2: CGPoint(x: 19.7, y: 7.1))
    path.addCurve(to: CGPoint(x: 14, y: 12.2), control1: CGPoint(x: 19.7, y: 10.1), control2: CGPoint(x: 16.9, y: 14.7))
    path.addCurve(to: CGPoint(x: 10, y: 12.2), control1: CGPoint(x: 14.7, y: 15.9), control2: CGPoint(x: 9.3, y: 15.9))
    path.addCurve(to: CGPoint(x: 7.6, y: 8.6), control1: CGPoint(x: 7.1, y: 14.7), control2: CGPoint(x: 4.3, y: 10.1))
    path.addCurve(to: CGPoint(x: 10, y: 5), control1: CGPoint(x: 4.3, y: 7.1), control2: CGPoint(x: 7.1, y: 2.5))
    path.closeSubpath()
    path.move(to: CGPoint(x: 3, y: 12.5))
    path.addCurve(to: CGPoint(x: 2, y: 9.5), control1: CGPoint(x: 2.3, y: 11.7), control2: CGPoint(x: 2, y: 10.8))
    path.move(to: CGPoint(x: 21, y: 10.5))
    path.addCurve(to: CGPoint(x: 22, y: 7.5), control1: CGPoint(x: 21.7, y: 9.7), control2: CGPoint(x: 22, y: 8.8))
    path.move(to: CGPoint(x: 4, y: 16.5))
    path.addCurve(to: CGPoint(x: 12, y: 21), control1: CGPoint(x: 5.5, y: 19.3), control2: CGPoint(x: 8.5, y: 21))
    path.addCurve(to: CGPoint(x: 20, y: 16.5), control1: CGPoint(x: 15.5, y: 21), control2: CGPoint(x: 18.5, y: 19.3))
    return path.applying(CGAffineTransform(scaleX: rect.width / 24, y: rect.height / 24))
  }
}
