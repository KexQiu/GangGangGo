import Foundation

struct WatchTrainingMode: Identifiable, Codable {
  static let standardId = "standard"
  static let standard = WatchTrainingMode(
    config: .init(id: standardId, holdSeconds: 5, restSeconds: 5, rounds: 12))

  var id: String
  var holdSeconds: Int
  var restSeconds: Int
  var rounds: Int

  init(config: WatchTodayState.TrainingModeConfig) {
    id = config.id
    holdSeconds = max(config.holdSeconds, 1)
    restSeconds = max(config.restSeconds, 1)
    rounds = max(config.rounds, 1)
  }

  var title: String {
    switch id {
    case "beginner":
      return "3 秒节奏"
    case "standard":
      return "5 秒节奏"
    case "quick":
      return "短收缩"
    default:
      return "自定义"
    }
  }

  var isAdjusted: Bool {
    guard let base = WatchTodayState.TrainingModeConfig.fallbackModes.first(where: { $0.id == id })
    else { return true }
    return holdSeconds != base.holdSeconds || restSeconds != base.restSeconds
      || rounds != base.rounds
  }
  var subtitle: String { "\(holdSeconds) 秒抬 · \(restSeconds) 秒放 · \(rounds) 次" }

  var totalDurationSeconds: Int {
    (holdSeconds + restSeconds) * rounds
  }

  static func modes(from configs: [WatchTodayState.TrainingModeConfig]) -> [WatchTrainingMode] {
    let modes = configs.map(WatchTrainingMode.init(config:))
    return modes.isEmpty ? [.standard] : modes
  }
}

enum WatchTrainingPhase: String, Codable {
  case prepare, hold, rest, ended
  var title: String {
    switch self {
    case .prepare: return "准备，正常呼吸"
    case .hold: return "轻轻向上收缩"
    case .rest: return "充分放松"
    case .ended: return "本次已结束"
    }
  }
  var key: String { rawValue }
}

struct WatchTrainingSession: Codable {
  let owner: WatchEventOwner
  let mode: WatchTrainingMode
  let startedAt: Date
  let id: String
  var updatedAt: Date
  var phase: WatchTrainingPhase = .prepare
  var elapsedDuration: TimeInterval = 0
  var phaseElapsed: TimeInterval = 0
  var completedRepetitions = 0
  var contractionComplete = false
  var interrupted = false
  var submissionLocked = false
  var runningSince: TimeInterval?
  var record: WatchTrainingRecord?

  init(
    owner: WatchEventOwner, mode: WatchTrainingMode, startedAt: Date = Date(),
    uptime: TimeInterval = ProcessInfo.processInfo.systemUptime
  ) {
    self.owner = owner
    self.mode = mode
    self.startedAt = startedAt
    self.updatedAt = startedAt
    id = "watch-" + UUID().uuidString
    runningSince = uptime
  }
  var isPaused: Bool { runningSince == nil }
  var isFinished: Bool { phase == .ended }
  private var phaseDuration: TimeInterval {
    switch phase {
    case .prepare: return 3
    case .hold: return TimeInterval(mode.holdSeconds)
    case .rest: return TimeInterval(mode.restSeconds)
    case .ended: return 0
    }
  }
  private func delta(_ uptime: TimeInterval) -> TimeInterval {
    runningSince.map { max(0, uptime - $0) } ?? 0
  }
  private func observed(_ uptime: TimeInterval) -> TimeInterval {
    min(delta(uptime), max(0, phaseDuration - phaseElapsed))
  }
  private mutating func accumulate(_ value: TimeInterval) {
    if phase == .hold || phase == .rest { elapsedDuration += value }
    phaseElapsed += value
  }
  mutating func sample(
    at date: Date = Date(), uptime: TimeInterval = ProcessInfo.processInfo.systemUptime
  ) {
    guard !isPaused, !isFinished else { return }
    let delay = delta(uptime)
    let remaining = phaseDuration - phaseElapsed
    accumulate(min(delay, remaining))
    runningSince = uptime
    updatedAt = date
    if delay > remaining + 0.25 {
      runningSince = nil
      interrupted = true
      if phase == .hold { contractionComplete = false }
      return
    }
    guard delay >= remaining else { return }
    switch phase {
    case .prepare: phase = .hold
    case .hold:
      contractionComplete = true
      phase = .rest
    case .rest:
      if contractionComplete { completedRepetitions += 1 }
      contractionComplete = false
      if completedRepetitions == mode.rounds {
        finish(reason: "completed", at: date, uptime: uptime)
      } else {
        phase = .hold
      }
    case .ended: break
    }
    phaseElapsed = 0
  }
  // 写入检查点之后实际发出提示，再从此刻开始完整阶段。
  mutating func confirmPrompt(
    at date: Date = Date(), uptime: TimeInterval = ProcessInfo.processInfo.systemUptime
  ) {
    guard !isPaused, !isFinished, phaseElapsed == 0 else { return }
    runningSince = uptime
    updatedAt = date
  }
  mutating func pause(
    at date: Date = Date(), uptime: TimeInterval = ProcessInfo.processInfo.systemUptime
  ) {
    if !isPaused && !isFinished {
      accumulate(observed(uptime))
      updatedAt = date
    }
    runningSince = nil
  }
  mutating func resume(
    at date: Date = Date(), uptime: TimeInterval = ProcessInfo.processInfo.systemUptime
  ) {
    guard isPaused, !isFinished, Calendar.current.isDate(updatedAt, inSameDayAs: date) else {
      return
    }
    phase = .rest
    phaseElapsed = 0
    interrupted = false
    runningSince = uptime
    updatedAt = date
  }
  mutating func finish(
    reason: String, at date: Date = Date(),
    uptime: TimeInterval = ProcessInfo.processInfo.systemUptime
  ) {
    guard record == nil else { return }
    pause(at: date, uptime: uptime)
    phase = .ended
    let completed = completedRepetitions == mode.rounds
    let formatter = ISO8601DateFormatter()
    record = WatchTrainingRecord(
      id: id, presetId: mode.id,
      plan: .init(
        contractSeconds: mode.holdSeconds, relaxSeconds: mode.restSeconds, repetitions: mode.rounds),
      startedAt: formatter.string(from: startedAt), endedAt: formatter.string(from: date),
      durationSeconds: Int(elapsedDuration.rounded(.down)),
      completedRepetitions: completedRepetitions,
      isCompleted: completed, feedback: reason == "discomfort" ? "reported" : "unanswered",
      endReason: completed ? "completed" : reason)
  }
  func snapshot(at date: Date = Date(), uptime: TimeInterval = ProcessInfo.processInfo.systemUptime)
    -> WatchTrainingSnapshot
  {
    let observed = observed(uptime)
    return WatchTrainingSnapshot(
      elapsedSeconds: Int(
        (elapsedDuration + ((phase == .hold || phase == .rest) ? observed : 0)).rounded(.down)),
      isFinished: isFinished, phase: phase, phaseKey: "\(completedRepetitions)-\(phase.key)",
      progress: Double(completedRepetitions) / Double(mode.rounds),
      remainingSeconds: Int(max(0, phaseDuration - phaseElapsed - observed).rounded(.up)),
      roundIndex: min(completedRepetitions, mode.rounds - 1))
  }
  func nextBoundary(
    after date: Date = Date(), uptime: TimeInterval = ProcessInfo.processInfo.systemUptime
  ) -> WatchTrainingBoundary? {
    guard !isPaused, !isFinished else { return nil }
    let delay = max(0, phaseDuration - phaseElapsed - delta(uptime))
    return WatchTrainingBoundary(date: date.addingTimeInterval(delay), delay: delay)
  }
}
struct WatchTrainingSnapshot {
  var elapsedSeconds: Int
  var isFinished: Bool
  var phase: WatchTrainingPhase
  var phaseKey: String
  var progress: Double
  var remainingSeconds: Int
  var roundIndex: Int
}
struct WatchTrainingBoundary {
  var date: Date
  var delay: TimeInterval
}

// 以账号归属保存活动快照和结束草稿；进程重启后绝不延续 uptime。
enum WatchTrainingDraftStore {
  private static func key(_ owner: WatchEventOwner) -> String {
    return "xiaotidu-training-v2-" + Data(owner.userId.utf8).base64EncodedString() + "."
      + Data(owner.profileId.utf8).base64EncodedString()
  }
  static func save(_ session: WatchTrainingSession) {
    guard let data = try? JSONEncoder().encode(session) else { return }
    UserDefaults.standard.set(data, forKey: key(session.owner))
  }
  static func load(_ owner: WatchEventOwner) -> WatchTrainingSession? {
    guard let data = UserDefaults.standard.data(forKey: key(owner)),
      var session = try? JSONDecoder().decode(WatchTrainingSession.self, from: data)
    else { return nil }
    session.runningSince = nil
    return session
  }
  static func clear(_ owner: WatchEventOwner) {
    UserDefaults.standard.removeObject(forKey: key(owner))
  }
}
