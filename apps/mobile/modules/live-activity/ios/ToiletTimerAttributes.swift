import ActivityKit
import Foundation

@available(iOS 16.1, *)
public struct ToiletTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var accumulatedElapsedSeconds: Double
    public var isPaused: Bool
    public var nextCueSeconds: Double?
    public var stageKey: String?
    public var stageMessage: String?
    public var stageTitle: String?
    public var targetSeconds: Double?
    public var timerStartDate: Date

    public init(
      accumulatedElapsedSeconds: Double,
      isPaused: Bool,
      nextCueSeconds: Double?,
      stageKey: String?,
      stageMessage: String?,
      stageTitle: String?,
      targetSeconds: Double?,
      timerStartDate: Date
    ) {
      self.accumulatedElapsedSeconds = accumulatedElapsedSeconds
      self.isPaused = isPaused
      self.nextCueSeconds = nextCueSeconds
      self.stageKey = stageKey
      self.stageMessage = stageMessage
      self.stageTitle = stageTitle
      self.targetSeconds = targetSeconds
      self.timerStartDate = timerStartDate
    }
  }

  public var title: String

  public init(title: String) {
    self.title = title
  }
}
