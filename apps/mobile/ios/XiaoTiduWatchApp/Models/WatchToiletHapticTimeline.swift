import Foundation

struct WatchToiletHapticBoundary: Equatable {
  var elapsedSeconds: Int
  var stage: WatchToiletStage
}

enum WatchToiletHapticTimeline {
  static let boundaries = [
    WatchToiletHapticBoundary(elapsedSeconds: 5 * 60, stage: .gentleWarning),
    WatchToiletHapticBoundary(elapsedSeconds: 10 * 60, stage: .strongWarning),
    WatchToiletHapticBoundary(elapsedSeconds: 15 * 60, stage: .overtime),
    WatchToiletHapticBoundary(elapsedSeconds: 20 * 60, stage: .severeWarning),
  ]

  static func nextBoundary(after elapsedSeconds: Int) -> WatchToiletHapticBoundary? {
    boundaries.first { $0.elapsedSeconds > elapsedSeconds }
  }
}
