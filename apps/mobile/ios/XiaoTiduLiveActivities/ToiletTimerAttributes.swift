import ActivityKit
import Foundation

@available(iOS 16.1, *)
struct ToiletTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var accumulatedElapsedSeconds: Double
    var isPaused: Bool
    var nextCueSeconds: Double?
    var stageKey: String?
    var stageMessage: String?
    var stageTitle: String?
    var targetSeconds: Double?
    var timerStartDate: Date
  }

  var title: String
}
