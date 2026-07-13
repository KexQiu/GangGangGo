import SwiftUI
import WatchKit

struct WatchTrainingView: View {
  @EnvironmentObject private var session: WatchSessionManager
  @State private var selectedModeId = WatchTrainingMode.standardId
  @State private var trainingSession: WatchTrainingSession?
  @State private var completedTraining: WatchTrainingCompletion?
  @State private var showingCancelConfirmation = false
  @State private var phaseBoundaryTask: Task<Void, Never>?

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
    .onAppear {
      scheduleNextTrainingBoundary()
    }
    .onDisappear {
      cancelTrainingBoundary()
    }
    .onChange(of: session.isApplicationActive) { _, isActive in
      if isActive {
        scheduleNextTrainingBoundary()
      } else {
        cancelTrainingBoundary()
      }
    }
  }

  private func startTraining() {
    let mode = currentSelectedMode
    selectedModeId = mode.id
    let session = WatchTrainingSession(mode: mode)
    trainingSession = session
    WKInterfaceDevice.current().play(.start)
    scheduleNextTrainingBoundary(for: session)
  }

  private func cancelTraining() {
    cancelTrainingBoundary()
    trainingSession = nil
    WKInterfaceDevice.current().play(.click)
  }

  private func resetTraining() {
    cancelTrainingBoundary()
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
    scheduleNextTrainingBoundary(for: currentSession)
  }

  private func scheduleNextTrainingBoundary(for session: WatchTrainingSession? = nil) {
    cancelTrainingBoundary()
    let currentSession = session ?? trainingSession
    guard self.session.isApplicationActive,
          let currentSession,
          let boundary = currentSession.nextBoundary(after: Date()) else {
      return
    }

    let expectedStartDate = currentSession.startedAt
    let delay = max(boundary.date.timeIntervalSinceNow, 0)
    phaseBoundaryTask = Task { @MainActor in
      do {
        try await Task.sleep(for: .seconds(delay))
      } catch {
        return
      }

      guard var activeSession = trainingSession,
            activeSession.startedAt == expectedStartDate,
            !activeSession.isPaused else {
        return
      }

      if boundary.isFinished {
        finishTraining(activeSession)
        return
      }

      if activeSession.lastNotifiedBoundaryKey != boundary.key, let phase = boundary.phase {
        activeSession.lastNotifiedBoundaryKey = boundary.key
        trainingSession = activeSession
        WKInterfaceDevice.current().play(phase == .hold ? .directionUp : .click)
      }

      scheduleNextTrainingBoundary(for: activeSession)
    }
  }

  private func cancelTrainingBoundary() {
    phaseBoundaryTask?.cancel()
    phaseBoundaryTask = nil
  }

  private func finishTraining(_ currentSession: WatchTrainingSession) {
    cancelTrainingBoundary()
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

private struct WatchTrainingCompletion {
  var mode: WatchTrainingMode
  var durationSeconds: Int
}
