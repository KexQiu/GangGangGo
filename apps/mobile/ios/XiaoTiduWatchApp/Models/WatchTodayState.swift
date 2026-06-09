import Foundation

struct WatchTodayState: Codable, Equatable {
  struct Account: Codable, Equatable {
    var isLoggedIn: Bool
    var nickname: String?
  }

  struct Habits: Codable, Equatable {
    var bowelDone: Bool
    var completion: Int
    var fiberDone: Bool
    var movementDone: Bool
    var waterDone: Bool
  }

  struct Toilet: Codable, Equatable {
    var elapsedSeconds: Int
    var isPaused: Bool
    var isRunning: Bool
    var sessionCount: Int
    var stage: String?

    init(elapsedSeconds: Int, isPaused: Bool, isRunning: Bool, sessionCount: Int, stage: String?) {
      self.elapsedSeconds = elapsedSeconds
      self.isPaused = isPaused
      self.isRunning = isRunning
      self.sessionCount = sessionCount
      self.stage = stage
    }

    init(from decoder: Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)

      elapsedSeconds = try container.decodeIfPresent(Int.self, forKey: .elapsedSeconds) ?? 0
      isPaused = try container.decodeIfPresent(Bool.self, forKey: .isPaused) ?? false
      isRunning = try container.decodeIfPresent(Bool.self, forKey: .isRunning) ?? false
      sessionCount = try container.decodeIfPresent(Int.self, forKey: .sessionCount) ?? 0
      stage = try container.decodeIfPresent(String.self, forKey: .stage)
    }
  }

  struct Training: Codable, Equatable {
    var completedSets: Int
    var done: Bool
  }

  var account: Account
  var date: String
  var generatedAt: String
  var habits: Habits
  var pendingEventCount: Int
  var proStatus: String
  var toilet: Toilet
  var training: Training

  static let placeholder = WatchTodayState(
    account: Account(isLoggedIn: false, nickname: nil),
    date: "--",
    generatedAt: ISO8601DateFormatter().string(from: Date()),
    habits: Habits(bowelDone: false, completion: 0, fiberDone: false, movementDone: false, waterDone: false),
    pendingEventCount: 0,
    proStatus: "free",
    toilet: Toilet(elapsedSeconds: 0, isPaused: false, isRunning: false, sessionCount: 0, stage: nil),
    training: Training(completedSets: 0, done: false)
  )
}

enum WatchToiletStage: String {
  case normal
  case gentleWarning = "gentle_warning"
  case strongWarning = "strong_warning"
  case overtime
  case severeWarning = "severe_warning"

  var title: String {
    switch self {
    case .normal:
      return "刚刚蹲下"
    case .gentleWarning:
      return "小声敲门"
    case .strongWarning:
      return "差不多该收工了"
    case .overtime:
      return "蹲会儿长会了"
    case .severeWarning:
      return "真的该收工了"
    }
  }
}

extension WatchTodayState {
  var isPro: Bool {
    proStatus == "pro_active" || proStatus == "pro_grace_period"
  }

  func currentToiletElapsedSeconds(now: Date = Date()) -> Int {
    guard toilet.isRunning, !toilet.isPaused else {
      return toilet.elapsedSeconds
    }

    guard let generatedAtDate = ISO8601DateFormatter().date(from: generatedAt) else {
      return toilet.elapsedSeconds
    }

    return max(toilet.elapsedSeconds + Int(now.timeIntervalSince(generatedAtDate)), toilet.elapsedSeconds)
  }

  func currentToiletStage(now: Date = Date()) -> WatchToiletStage? {
    guard toilet.isRunning else {
      return nil
    }

    let elapsedSeconds = currentToiletElapsedSeconds(now: now)

    if elapsedSeconds >= 20 * 60 {
      return .severeWarning
    }

    if elapsedSeconds >= 15 * 60 {
      return .overtime
    }

    if elapsedSeconds >= 10 * 60 {
      return .strongWarning
    }

    if elapsedSeconds >= 5 * 60 {
      return .gentleWarning
    }

    return .normal
  }
}
