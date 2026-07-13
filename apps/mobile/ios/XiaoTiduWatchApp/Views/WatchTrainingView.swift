import SwiftUI
import WatchKit

struct WatchTrainingView: View {
  @EnvironmentObject private var session: WatchSessionManager
  @State private var selectedModeId = WatchTrainingMode.standardId
  @State private var trainingSession: WatchTrainingSession?
  @State private var completedTraining: WatchTrainingCompletion?
  @State private var showingCancelConfirmation = false

  private let checkpointTick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

  var body: some View {
    Group {
      if !session.todayState.isPro {
        WatchProLockedContent()
      } else if let completedTraining {
        TrainingCompletionContent(
          completion: completedTraining,
          onDone: resetTraining
        )
      } else if let trainingSession {
        TrainingSessionContent(
          session: trainingSession,
          onCancel: {
            showingCancelConfirmation = true
          },
          onTogglePause: togglePause
        )
      } else {
        TrainingModePicker(
          modes: trainingModes,
          selectedModeId: $selectedModeId,
          onStart: startTraining
        )
      }
    }
    .navigationTitle("菊花抬")
    .navigationBarBackButtonHidden(trainingSession != nil)
    .confirmationDialog("要结束这组训练吗？", isPresented: $showingCancelConfirmation, titleVisibility: .visible) {
      Button("结束，不记录", role: .destructive) {
        cancelTraining()
      }
      Button("继续训练", role: .cancel) {}
    } message: {
      Text("这组还没完成，结束后不会记入今日菊花抬。")
    }
    .onReceive(checkpointTick) { date in
      checkTrainingCheckpoint(at: date)
    }
  }

  private func startTraining() {
    let mode = currentSelectedMode
    selectedModeId = mode.id
    trainingSession = WatchTrainingSession(mode: mode)
    WKInterfaceDevice.current().play(.start)
  }

  private func cancelTraining() {
    trainingSession = nil
    WKInterfaceDevice.current().play(.click)
  }

  private func resetTraining() {
    completedTraining = nil
    trainingSession = nil
  }

  private func togglePause() {
    guard var currentSession = trainingSession else {
      return
    }

    let now = Date()
    let snapshot = currentSession.snapshot(at: now)
    guard !snapshot.isFinished else {
      finishTraining(currentSession)
      return
    }

    currentSession.togglePause(at: now)
    trainingSession = currentSession
    WKInterfaceDevice.current().play(.click)
  }

  private func checkTrainingCheckpoint(at date: Date) {
    guard var currentSession = trainingSession else {
      return
    }

    let snapshot = currentSession.snapshot(at: date)
    if snapshot.isFinished {
      finishTraining(currentSession)
      return
    }

    guard !currentSession.isPaused, snapshot.phaseKey != currentSession.lastNotifiedPhaseKey else {
      return
    }

    currentSession.lastNotifiedPhaseKey = snapshot.phaseKey
    trainingSession = currentSession
    WKInterfaceDevice.current().play(snapshot.phase == .hold ? .directionUp : .click)
  }

  private func finishTraining(_ currentSession: WatchTrainingSession) {
    trainingSession = nil
    WKInterfaceDevice.current().play(.success)
    session.sendTrainingCompleted(
      mode: currentSession.mode.id,
      completedSets: 1,
      durationSeconds: currentSession.mode.totalDurationSeconds
    )
    completedTraining = WatchTrainingCompletion(
      mode: currentSession.mode,
      durationSeconds: currentSession.mode.totalDurationSeconds
    )
  }

  private var trainingModes: [WatchTrainingMode] {
    WatchTrainingMode.modes(from: session.todayState.trainingModes)
  }

  private var currentSelectedMode: WatchTrainingMode {
    trainingModes.first { $0.id == selectedModeId } ?? trainingModes.first ?? .standard
  }
}

private struct TrainingModePicker: View {
  var modes: [WatchTrainingMode]
  @Binding var selectedModeId: String
  var onStart: () -> Void

  var body: some View {
    ScrollView(.vertical) {
      VStack(alignment: .leading, spacing: 8) {
        Text("选择节奏")
          .font(.headline)
          .padding(.horizontal, 2)

        ForEach(modes) { mode in
          Button {
            if selectedModeId == mode.id {
              onStart()
            } else {
              selectedModeId = mode.id
            }
          } label: {
            TrainingModeOption(mode: mode, isSelected: selectedModeId == mode.id)
          }
          .buttonStyle(.plain)
        }

        Button {
          onStart()
        } label: {
          Label("开始一组", systemImage: "play.fill")
            .font(.headline)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)

        Text("手表只记轻量完成，不记录敏感细节。")
          .font(.caption2)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity)
      }
      .padding(.horizontal)
      .padding(.vertical, 8)
    }
  }
}

private struct TrainingModeOption: View {
  var mode: WatchTrainingMode
  var isSelected: Bool

  var body: some View {
    HStack(spacing: 8) {
      VStack(alignment: .leading, spacing: 3) {
        Text(mode.title)
          .fontWeight(.semibold)
        Text(mode.subtitle)
          .font(.caption2)
          .foregroundStyle(.secondary)
      }

      Spacer(minLength: 4)

      VStack(alignment: .trailing, spacing: 2) {
        Text("\(mode.totalDurationSeconds) 秒")
          .font(.caption2)
          .foregroundStyle(.secondary)

        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
          .foregroundStyle(isSelected ? .green : .secondary)
          .imageScale(.medium)
      }
    }
    .padding(.horizontal, 10)
    .padding(.vertical, 9)
    .frame(maxWidth: .infinity)
    .background {
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .fill(isSelected ? Color.green.opacity(0.18) : Color.secondary.opacity(0.12))
    }
  }
}

private struct TrainingSessionContent: View {
  var session: WatchTrainingSession
  var onCancel: () -> Void
  var onTogglePause: () -> Void

  var body: some View {
    TimelineView(.periodic(from: session.startedAt, by: 1)) { context in
      let snapshot = session.snapshot(at: context.date)

      VStack(spacing: 10) {
        Text(session.isPaused ? "已暂停" : snapshot.phase.title)
          .font(.headline)

        Text("\(snapshot.remainingSeconds)")
          .font(.system(size: 44, weight: .bold, design: .rounded))
          .monospacedDigit()

        ProgressView(value: snapshot.progress)
          .tint(.green)

        Text("第 \(snapshot.roundIndex + 1)/\(session.mode.rounds) 次 · \(session.mode.title)")
          .font(.caption2)
          .foregroundStyle(.secondary)

        Button(session.isPaused ? "继续" : "暂停") {
          onTogglePause()
        }
        .font(.caption)

        Button("结束本组", role: .destructive) {
          onCancel()
        }
        .font(.caption2)
      }
      .padding()
    }
  }
}

private struct TrainingCompletionContent: View {
  var completion: WatchTrainingCompletion
  var onDone: () -> Void

  var body: some View {
    VStack(spacing: 12) {
      Image(systemName: "checkmark.circle.fill")
        .font(.system(size: 38, weight: .bold))
        .foregroundStyle(.green)

      Text("一组完成")
        .font(.headline)

      Text("\(completion.mode.title) · \(completion.durationSeconds) 秒")
        .font(.caption)
        .foregroundStyle(.secondary)

      Text("已发给 iPhone，同步后会计入今日菊花抬。")
        .font(.caption2)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)

      Button("完成") {
        onDone()
      }
      .buttonStyle(.borderedProminent)
    }
    .padding()
  }
}

private struct WatchTrainingMode: Identifiable {
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

private enum WatchTrainingPhase {
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

private struct WatchTrainingSession {
  let mode: WatchTrainingMode
  let startedAt: Date
  var pausedAt: Date?
  var accumulatedPausedDuration: TimeInterval = 0
  var lastNotifiedPhaseKey: String

  init(mode: WatchTrainingMode, startedAt: Date = Date()) {
    self.mode = mode
    self.startedAt = startedAt
    lastNotifiedPhaseKey = Self.phaseKey(roundIndex: 0, phase: .hold)
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

  private func activeElapsedDuration(at date: Date) -> TimeInterval {
    let referenceDate = pausedAt ?? date
    let elapsed = referenceDate.timeIntervalSince(startedAt) - accumulatedPausedDuration
    return min(max(elapsed, 0), TimeInterval(mode.totalDurationSeconds))
  }

  private static func phaseKey(roundIndex: Int, phase: WatchTrainingPhase) -> String {
    "\(roundIndex)-\(phase.key)"
  }
}

private struct WatchTrainingSnapshot {
  var elapsedSeconds: Int
  var isFinished: Bool
  var phase: WatchTrainingPhase
  var phaseKey: String
  var progress: Double
  var remainingSeconds: Int
  var roundIndex: Int
}

private struct WatchTrainingCompletion {
  var mode: WatchTrainingMode
  var durationSeconds: Int
}
