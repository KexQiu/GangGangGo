import SwiftUI
import WatchKit

struct WatchTrainingView: View {
  @EnvironmentObject private var session: WatchSessionManager
  @State private var selectedMode: WatchTrainingMode = .standard
  @State private var trainingSession: WatchTrainingSession?

  private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

  var body: some View {
    Group {
      if let trainingSession {
        TrainingSessionContent(
          mode: selectedMode,
          session: trainingSession,
          onStop: stopTraining
        )
      } else {
        TrainingModePicker(
          selectedMode: $selectedMode,
          onStart: startTraining
        )
      }
    }
    .navigationTitle("菊花抬")
    .onReceive(tick) { _ in
      advanceTraining()
    }
  }

  private func startTraining() {
    trainingSession = WatchTrainingSession(mode: selectedMode)
    WKInterfaceDevice.current().play(.start)
  }

  private func stopTraining() {
    trainingSession = nil
    WKInterfaceDevice.current().play(.click)
  }

  private func advanceTraining() {
    guard var currentSession = trainingSession else {
      return
    }

    let result = currentSession.advance()
    trainingSession = result.session

    switch result.haptic {
    case .none:
      break
    case .phase:
      WKInterfaceDevice.current().play(currentSession.phase == .hold ? .directionUp : .click)
    case .finished:
      WKInterfaceDevice.current().play(.success)
      session.sendTrainingCompleted(
        mode: selectedMode.id,
        completedSets: 1,
        durationSeconds: selectedMode.totalDurationSeconds
      )
    }
  }
}

private struct TrainingModePicker: View {
  @Binding var selectedMode: WatchTrainingMode
  var onStart: () -> Void

  var body: some View {
    List {
      Section {
        ForEach(WatchTrainingMode.allCases) { mode in
          Button {
            selectedMode = mode
          } label: {
            HStack {
              VStack(alignment: .leading, spacing: 3) {
                Text(mode.title)
                  .fontWeight(.semibold)
                Text(mode.subtitle)
                  .font(.caption2)
                  .foregroundStyle(.secondary)
              }
              Spacer()
              if selectedMode == mode {
                Image(systemName: "checkmark.circle.fill")
                  .foregroundStyle(.green)
              }
            }
          }
        }
      } header: {
        Text("选择节奏")
      }

      Section {
        Button("开始一组") {
          onStart()
        }
        .buttonStyle(.borderedProminent)
      } footer: {
        Text("手表只记轻量完成，不记录敏感细节。")
      }
    }
  }
}

private struct TrainingSessionContent: View {
  var mode: WatchTrainingMode
  var session: WatchTrainingSession
  var onStop: () -> Void

  var body: some View {
    VStack(spacing: 10) {
      Text(session.phase.title)
        .font(.headline)

      Text("\(session.remainingSeconds)")
        .font(.system(size: 44, weight: .bold, design: .rounded))
        .monospacedDigit()
        .contentTransition(.numericText())

      ProgressView(value: session.progress)
        .tint(.green)

      Text("第 \(session.roundIndex + 1)/\(mode.rounds) 次 · \(mode.title)")
        .font(.caption2)
        .foregroundStyle(.secondary)

      Button("先停一下") {
        onStop()
      }
      .font(.caption)
    }
    .padding()
  }
}

private enum WatchTrainingMode: String, CaseIterable, Identifiable {
  case beginner
  case standard
  case quick

  var id: String {
    rawValue
  }

  var title: String {
    switch self {
    case .beginner:
      return "新手"
    case .standard:
      return "标准"
    case .quick:
      return "快速"
    }
  }

  var subtitle: String {
    switch self {
    case .beginner:
      return "轻轻来，慢一点"
    case .standard:
      return "日常节奏"
    case .quick:
      return "短促收放"
    }
  }

  var holdSeconds: Int {
    switch self {
    case .beginner:
      return 3
    case .standard:
      return 5
    case .quick:
      return 2
    }
  }

  var restSeconds: Int {
    switch self {
    case .beginner:
      return 4
    case .standard:
      return 5
    case .quick:
      return 2
    }
  }

  var rounds: Int {
    switch self {
    case .beginner:
      return 6
    case .standard:
      return 8
    case .quick:
      return 10
    }
  }

  var totalDurationSeconds: Int {
    (holdSeconds + restSeconds) * rounds
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
}

private struct WatchTrainingSession {
  var phase: WatchTrainingPhase = .hold
  var remainingSeconds: Int
  var roundIndex = 0
  var elapsedSeconds = 0
  let mode: WatchTrainingMode

  init(mode: WatchTrainingMode) {
    self.mode = mode
    remainingSeconds = mode.holdSeconds
  }

  var progress: Double {
    min(Double(elapsedSeconds) / Double(mode.totalDurationSeconds), 1)
  }

  mutating func advance() -> WatchTrainingAdvanceResult {
    remainingSeconds -= 1
    elapsedSeconds += 1

    if elapsedSeconds >= mode.totalDurationSeconds {
      return WatchTrainingAdvanceResult(session: nil, haptic: .finished)
    }

    guard remainingSeconds <= 0 else {
      return WatchTrainingAdvanceResult(session: self, haptic: .none)
    }

    switch phase {
    case .hold:
      phase = .rest
      remainingSeconds = mode.restSeconds
    case .rest:
      phase = .hold
      roundIndex += 1
      remainingSeconds = mode.holdSeconds
    }

    return WatchTrainingAdvanceResult(session: self, haptic: .phase)
  }
}

private struct WatchTrainingAdvanceResult {
  enum Haptic {
    case none
    case phase
    case finished
  }

  var session: WatchTrainingSession?
  var haptic: Haptic
}
