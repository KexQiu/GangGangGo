import ActivityKit
import Foundation

@available(iOS 16.1, *)
struct ToiletTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var accumulatedElapsedSeconds: Double
    var isPaused: Bool
    var timerStartDate: Date
  }

  var title: String
}
