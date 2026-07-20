import Foundation

struct WatchTrainingMode: Identifiable {
  static let standardId = "standard"
  static let standard = WatchTrainingMode(config: .init(id: standardId, holdSeconds: 5, restSeconds: 5, rounds: 12))

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
      return "新手"
    case "standard":
      return "标准"
    case "quick":
      return "快速"
    default:
      return "自定义"
    }
  }

  var subtitle: String {
    switch id {
    case "beginner":
      return "轻轻来，慢一点"
    case "standard":
      return "日常节奏"
    case "quick":
      return "短促收放"
    default:
      return "\(holdSeconds) 秒抬 · \(restSeconds) 秒放"
    }
  }

  var totalDurationSeconds: Int {
    (holdSeconds + restSeconds) * rounds
  }

  static func modes(from configs: [WatchTodayState.TrainingModeConfig]) -> [WatchTrainingMode] {
    let modes = configs.map(WatchTrainingMode.init(config:))
    return modes.isEmpty ? [.standard] : modes
  }
}

enum WatchTrainingPhase {
  case hold
  case rest

  var title: String {
    switch self {
    case .hold:
      return "轻轻抬"
    case .rest:
      return "放松"
    }
  }

  var key: String {
    switch self {
    case .hold:
      return "hold"
    case .rest:
      return "rest"
    }
  }
}

struct WatchTrainingSession {
  let mode: WatchTrainingMode
  let startedAt: Date
  var pausedAt: Date?
  var accumulatedPausedDuration: TimeInterval = 0
  var lastNotifiedBoundaryKey: String

  init(mode: WatchTrainingMode, startedAt: Date = Date()) {
    self.mode = mode
    self.startedAt = startedAt
    lastNotifiedBoundaryKey = Self.phaseKey(roundIndex: 0, phase: .hold)
  }

  var isPaused: Bool {
    pausedAt != nil
  }

  mutating func togglePause(at date: Date) {
    if let pausedAt {
      accumulatedPausedDuration += max(date.timeIntervalSince(pausedAt), 0)
      self.pausedAt = nil
    } else {
      pausedAt = date
    }
  }

  func snapshot(at date: Date) -> WatchTrainingSnapshot {
    let totalDurationSeconds = mode.totalDurationSeconds
    let elapsedSeconds = min(
      max(Int(activeElapsedDuration(at: date).rounded(.down)), 0),
      totalDurationSeconds
    )

    if elapsedSeconds >= totalDurationSeconds {
      return WatchTrainingSnapshot(
        elapsedSeconds: totalDurationSeconds,
        isFinished: true,
        phase: .rest,
        phaseKey: "finished",
        progress: 1,
        remainingSeconds: 0,
        roundIndex: max(mode.rounds - 1, 0)
      )
    }

    let cycleSeconds = mode.holdSeconds + mode.restSeconds
    let roundIndex = min(elapsedSeconds / cycleSeconds, max(mode.rounds - 1, 0))
    let cycleElapsedSeconds = elapsedSeconds % cycleSeconds

    let phase: WatchTrainingPhase
    let remainingSeconds: Int
    if cycleElapsedSeconds < mode.holdSeconds {
      phase = .hold
      remainingSeconds = mode.holdSeconds - cycleElapsedSeconds
    } else {
      phase = .rest
      remainingSeconds = cycleSeconds - cycleElapsedSeconds
    }

    return WatchTrainingSnapshot(
      elapsedSeconds: elapsedSeconds,
      isFinished: false,
      phase: phase,
      phaseKey: Self.phaseKey(roundIndex: roundIndex, phase: phase),
      progress: min(Double(elapsedSeconds) / Double(totalDurationSeconds), 1),
      remainingSeconds: remainingSeconds,
      roundIndex: roundIndex
    )
  }

  func nextBoundary(after date: Date) -> WatchTrainingBoundary? {
    guard !isPaused else {
      return nil
    }

    let elapsed = activeElapsedDuration(at: date)
    let totalDuration = TimeInterval(mode.totalDurationSeconds)
    guard elapsed < totalDuration else {
      return nil
    }

    let cycleDuration = TimeInterval(mode.holdSeconds + mode.restSeconds)
    let cycleIndex = Int(elapsed / cycleDuration)
    let cycleStart = TimeInterval(cycleIndex) * cycleDuration
    let elapsedInCycle = elapsed - cycleStart
    let holdDuration = TimeInterval(mode.holdSeconds)

    let boundaryElapsed: TimeInterval
    let boundaryPhase: WatchTrainingPhase?
    let boundaryKey: String
    if elapsedInCycle < holdDuration {
      boundaryElapsed = min(cycleStart + holdDuration, totalDuration)
      boundaryPhase = boundaryElapsed >= totalDuration ? nil : .rest
      boundaryKey = boundaryPhase.map { Self.phaseKey(roundIndex: cycleIndex, phase: $0) } ?? "finished"
    } else {
      boundaryElapsed = min(cycleStart + cycleDuration, totalDuration)
      let nextRoundIndex = min(cycleIndex + 1, max(mode.rounds - 1, 0))
      boundaryPhase = boundaryElapsed >= totalDuration ? nil : .hold
      boundaryKey = boundaryPhase.map { Self.phaseKey(roundIndex: nextRoundIndex, phase: $0) } ?? "finished"
    }

    return WatchTrainingBoundary(
      date: date.addingTimeInterval(max(boundaryElapsed - elapsed, 0)),
      isFinished: boundaryElapsed >= totalDuration,
      key: boundaryKey,
      phase: boundaryPhase
    )
  }

  private func activeElapsedDuration(at date: Date) -> TimeInterval {
    let referenceDate = pausedAt ?? date
    let elapsed = referenceDate.timeIntervalSince(startedAt) - accumulatedPausedDuration
    return min(max(elapsed, 0), TimeInterval(mode.totalDurationSeconds))
  }

  private static func phaseKey(roundIndex: Int, phase: WatchTrainingPhase) -> String {
    "\(roundIndex)-\(phase.key)"
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
  var isFinished: Bool
  var key: String
  var phase: WatchTrainingPhase?
}
