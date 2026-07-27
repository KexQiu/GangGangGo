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

  struct TrainingModeConfig: Codable, Equatable {
    var holdSeconds: Int
    var id: String
    var restSeconds: Int
    var rounds: Int

    init(id: String, holdSeconds: Int, restSeconds: Int, rounds: Int) {
      self.id = id
      self.holdSeconds = holdSeconds
      self.restSeconds = restSeconds
      self.rounds = rounds
    }

    init(from decoder: Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)

      id = try container.decodeIfPresent(String.self, forKey: .id) ?? "standard"
      holdSeconds = max(try container.decodeIfPresent(Int.self, forKey: .holdSeconds) ?? 5, 1)
      restSeconds = max(try container.decodeIfPresent(Int.self, forKey: .restSeconds) ?? 5, 1)
      rounds = max(try container.decodeIfPresent(Int.self, forKey: .rounds) ?? 12, 1)
    }

    static let fallbackModes = [
      TrainingModeConfig(id: "beginner", holdSeconds: 3, restSeconds: 3, rounds: 10),
      TrainingModeConfig(id: "standard", holdSeconds: 5, restSeconds: 5, rounds: 12),
      TrainingModeConfig(id: "quick", holdSeconds: 1, restSeconds: 1, rounds: 16),
    ]
  }

  var account: Account
  var canUseActions: Bool
  var date: String
  var generatedAt: String
  var habits: Habits
  var pendingEventCount: Int
  var proStatus: String
  var schemaVersion: Int
  var toilet: Toilet
  var training: Training
  var trainingModes: [TrainingModeConfig]

  init(
    account: Account,
    canUseActions: Bool = false,
    date: String,
    generatedAt: String,
    habits: Habits,
    pendingEventCount: Int,
    proStatus: String,
    schemaVersion: Int = 3,
    toilet: Toilet,
    training: Training,
    trainingModes: [TrainingModeConfig] = TrainingModeConfig.fallbackModes
  ) {
    self.account = account
    self.canUseActions = canUseActions
    self.date = date
    self.generatedAt = generatedAt
    self.habits = habits
    self.pendingEventCount = pendingEventCount
    self.proStatus = proStatus
    self.schemaVersion = schemaVersion
    self.toilet = toilet
    self.training = training
    self.trainingModes = trainingModes.isEmpty ? TrainingModeConfig.fallbackModes : trainingModes
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)

    account = try container.decode(Account.self, forKey: .account)
    date = try container.decode(String.self, forKey: .date)
    generatedAt = try container.decode(String.self, forKey: .generatedAt)
    habits = try container.decode(Habits.self, forKey: .habits)
    pendingEventCount = try container.decodeIfPresent(Int.self, forKey: .pendingEventCount) ?? 0
    proStatus = try container.decode(String.self, forKey: .proStatus)
    canUseActions = try container.decodeIfPresent(Bool.self, forKey: .canUseActions)
      ?? (proStatus == "pro_active" || proStatus == "pro_grace_period")
    schemaVersion = try container.decodeIfPresent(Int.self, forKey: .schemaVersion) ?? 1
    toilet = try container.decode(Toilet.self, forKey: .toilet)
    training = try container.decode(Training.self, forKey: .training)

    if let decodedModes = try container.decodeIfPresent([TrainingModeConfig].self, forKey: .trainingModes), !decodedModes.isEmpty {
      trainingModes = decodedModes
    } else {
      trainingModes = TrainingModeConfig.fallbackModes
    }
  }

  static let placeholder = WatchTodayState(
    account: Account(isLoggedIn: false, nickname: nil),
    canUseActions: false,
    date: "--",
    generatedAt: ISO8601DateFormatter().string(from: Date()),
    habits: Habits(bowelDone: false, completion: 0, fiberDone: false, movementDone: false, waterDone: false),
    pendingEventCount: 0,
    proStatus: "free",
    toilet: Toilet(elapsedSeconds: 0, isPaused: false, isRunning: false, sessionCount: 0, stage: nil),
    training: Training(completedSets: 0, done: false),
    trainingModes: TrainingModeConfig.fallbackModes
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

enum WatchSharedStateStore {
  static let appGroupIdentifier = "group.com.kex.xiaotidu.watch"
  static let stateStorageKey = "xiaotidu-watch-today-state"
  static let staleInterval: TimeInterval = 30 * 60
  static let widgetKind = "xiaotidu_today_complication"

  static func load() -> WatchTodayState? {
    guard let data = sharedDefaults.data(forKey: stateStorageKey) else {
      return nil
    }

    return try? JSONDecoder().decode(WatchTodayState.self, from: data)
  }

  static func save(_ state: WatchTodayState) {
    guard let data = try? JSONEncoder().encode(state) else {
      return
    }

    sharedDefaults.set(data, forKey: stateStorageKey)
  }

  static func isStale(_ state: WatchTodayState, now: Date = Date()) -> Bool {
    guard let generatedAt = WatchDateParser.date(from: state.generatedAt) else {
      return true
    }

    return now.timeIntervalSince(generatedAt) > staleInterval
  }

  private static var sharedDefaults: UserDefaults {
    UserDefaults(suiteName: appGroupIdentifier) ?? .standard
  }
}

private enum WatchDateParser {
  private static let fractionalFormatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()

  private static let standardFormatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter
  }()

  static func date(from value: String) -> Date? {
    fractionalFormatter.date(from: value) ?? standardFormatter.date(from: value)
  }
}

extension WatchTodayState {
  var actionLockedTitle: String {
    if !account.isLoggedIn {
      return "先登录小提督"
    }

    return "手表操作暂不可用"
  }

  var actionLockedBody: String {
    if !account.isLoggedIn {
      return "先在 iPhone 上登录小提督，手表就能同步今日低敏状态。"
    }

    return "请在 iPhone 上刷新账号状态后再试。手表仍会显示今日低敏状态。"
  }

  func currentToiletElapsedSeconds(now: Date = Date()) -> Int {
    guard toilet.isRunning, !toilet.isPaused else {
      return toilet.elapsedSeconds
    }

    guard let generatedAtDate = WatchDateParser.date(from: generatedAt) else {
      return toilet.elapsedSeconds
    }

    let elapsedSinceSnapshot = now.timeIntervalSince(generatedAtDate)
    guard elapsedSinceSnapshot.isFinite else {
      return toilet.elapsedSeconds
    }

    return max(toilet.elapsedSeconds + Int(elapsedSinceSnapshot.rounded(.down)), toilet.elapsedSeconds)
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
