import SwiftUI
import WatchKit

struct WatchTrainingView: View {
  @EnvironmentObject private var session: WatchSessionManager
  @State private var selectedModeId = "beginner"
  @State private var trainingSession: WatchTrainingSession?
  @State private var completedRecord: WatchTrainingRecord?
  @State private var completedEventId: String?
  @State private var showingCancelConfirmation = false
  @State private var phaseBoundaryTask: Task<Void, Never>?
  @State private var saving = false
  @State private var error: String?

  var body: some View {
    Group {
      if let record = completedRecord {
        ScrollView {
          VStack(spacing: 12) {
            Text("记录已结束").font(.headline)
            Text(
              "\(record.completedRepetitions)/\(record.plan.repetitions) 次 · \(record.durationSeconds) 秒"
            )
            Text(
              record.feedback == "reported" ? "有不适时停止练习，咨询专业人员。可在手机暂停训练提醒。" : "记录不代表动作质量或训练量适合个人。"
            )
            .font(.caption2)
            Text(deliveryText).font(.caption2)
            Button("返回选择") {
              completedRecord = nil
              completedEventId = nil
            }
          }.padding()
        }
      } else if let current = trainingSession {
        if let record = current.record {
          ScrollView {
            VStack(spacing: 10) {
              Text("已结束，请充分放松").font(.headline)
              Text(
                "\(record.completedRepetitions)/\(record.plan.repetitions) 次 · \(record.durationSeconds) 秒"
              ).font(.caption)
              Text("本次有没有不适？可跳过。离开时保留已有反馈并保存。").font(.caption2)
              if !current.submissionLocked {
                Button("无不适，保存") { Task { await saveRecord(feedback: "none") } }
                Button("有不适，保存") { Task { await saveRecord(feedback: "reported") } }
              }
              Button(record.feedback == "reported" ? "保留不适反馈并保存" : "跳过并保存") {
                Task { await saveRecord() }
              }
              if let error { Text(error).font(.caption2).foregroundStyle(.orange) }
              if !session.todayState.canUseActions { Text("请在手机恢复原账号权限后保存。草稿已保留。").font(.caption2) }
            }.disabled(saving).padding()
          }
        } else {
          TrainingSessionContent(
            session: current, canResume: session.todayState.canUseActions && !isStale(current),
            onCancel: {
              pauseTraining()
              showingCancelConfirmation = true
            }, onTogglePause: togglePause,
            onDiscomfort: { finishTraining(reason: "discomfort") })
        }
      } else if !session.todayState.canUseActions {
        WatchActionLockedContent()
      } else {
        TrainingModePicker(
          modes: trainingModes, selectedModeId: $selectedModeId, onStart: startTraining)
      }
    }
    .navigationTitle("菊花抬")
    .navigationBarBackButtonHidden(trainingSession?.record == nil && trainingSession != nil)
    .confirmationDialog(
      "结束这次练习？", isPresented: $showingCancelConfirmation, titleVisibility: .visible
    ) {
      Button("结束并记录") {
        finishTraining(
          reason: trainingSession.map(isStale) == true ? "interrupted" : "user_stopped")
      }
      Button("放弃记录", role: .destructive) {
        if let current = trainingSession { WatchTrainingDraftStore.clear(current.owner) }
        trainingSession = nil
      }
      Button("保持暂停", role: .cancel) {}
    } message: {
      Text("已停止计时，请充分放松。可以保留已完成记录。")
    }
    .onAppear { restoreTraining() }
    .onDisappear {
      pauseTraining()
      if trainingSession?.record != nil { Task { await saveRecord() } }
    }
    .onChange(of: session.isApplicationActive) { _, active in if !active { pauseTraining() } }
    .onChange(of: session.todayState.canUseActions) { _, allowed in if !allowed { pauseTraining() }
    }
    .onChange(of: session.todayState.account.owner) { _, _ in
      pauseTraining()
      trainingSession = nil
      completedRecord = nil
      restoreTraining()
    }
  }
  private var trainingModes: [WatchTrainingMode] {
    WatchTrainingMode.modes(from: session.todayState.trainingModes)
  }
  private func isStale(_ current: WatchTrainingSession) -> Bool {
    !Calendar.current.isDateInToday(current.updatedAt)
  }
  private func restoreTraining() {
    guard trainingSession == nil, let owner = session.todayState.account.owner else { return }
    trainingSession = WatchTrainingDraftStore.load(owner)
  }
  private func startTraining() {
    guard session.isApplicationActive, session.todayState.canUseActions,
      let owner = session.todayState.account.owner,
      let mode = trainingModes.first(where: { $0.id == selectedModeId }) ?? trainingModes.first
    else { return }
    trainingSession = WatchTrainingSession(owner: owner, mode: mode)
    persist()
    startPromptedPhase()
  }
  private func persist() {
    if let current = trainingSession { WatchTrainingDraftStore.save(current) }
  }
  private func pauseTraining() {
    phaseBoundaryTask?.cancel()
    phaseBoundaryTask = nil
    guard var current = trainingSession, !current.isFinished else { return }
    // 保持已过期检查点的日期，不能通过浏览页面重新使其可继续。
    if !current.isPaused { current.pause() }
    trainingSession = current
    persist()
  }
  private func togglePause() {
    guard var current = trainingSession, !current.isFinished else { return }
    if current.isPaused {
      guard session.isApplicationActive, session.todayState.canUseActions, !isStale(current),
        current.owner == session.todayState.account.owner
      else { return }
      current.resume()
      trainingSession = current
      persist()
      startPromptedPhase()
    } else {
      pauseTraining()
    }
  }
  private func startPromptedPhase() {
    guard var current = trainingSession, !current.isPaused, !current.isFinished else {
      scheduleBoundary()
      return
    }
    WKInterfaceDevice.current().play(current.phase == .hold ? .directionUp : .click)
    current.confirmPrompt()
    trainingSession = current
    scheduleBoundary()
  }
  private func scheduleBoundary() {
    phaseBoundaryTask?.cancel()
    phaseBoundaryTask = nil
    guard session.isApplicationActive, session.todayState.canUseActions,
      let current = trainingSession,
      let boundary = current.nextBoundary()
    else { return }
    let id = current.id
    phaseBoundaryTask = Task { @MainActor in
      do { try await Task.sleep(for: .seconds(boundary.delay)) } catch { return }
      guard session.isApplicationActive, session.todayState.canUseActions,
        var active = trainingSession, active.id == id, !active.isPaused,
        active.owner == session.todayState.account.owner
      else {
        pauseTraining()
        return
      }
      active.sample()
      trainingSession = active
      persist()
      startPromptedPhase()
    }
  }
  private func finishTraining(reason: String) {
    phaseBoundaryTask?.cancel()
    phaseBoundaryTask = nil
    guard var current = trainingSession else { return }
    current.finish(reason: reason)
    trainingSession = current
    persist()
  }
  private func saveRecord(feedback: String? = nil) async {
    guard !saving, var current = trainingSession, var record = current.record else { return }
    saving = true
    defer { saving = false }
    if let feedback, !current.submissionLocked { record.feedback = feedback }
    current.record = record
    current.submissionLocked = true
    trainingSession = current
    persist()
    guard let eventId = await session.sendTrainingFinished(owner: current.owner, record: record)
    else {
      error = "暂未保存到手机，已保留草稿，请恢复原账号权限后重试。"
      return
    }
    WatchTrainingDraftStore.clear(current.owner)
    // 异步入队期间账号可能变化，禁止把旧账号结果显示到新账号。
    guard current.owner == session.todayState.account.owner else { return }
    trainingSession = nil
    completedRecord = record
    completedEventId = eventId
    error = nil
  }
  private var deliveryText: String {
    guard let delivery = session.trainingDelivery, delivery.eventId == completedEventId else {
      return "等待 iPhone 确认保存。"
    }
    switch delivery.disposition {
    case .accepted, .duplicate: return "iPhone 已确认保存。"
    case .rejected: return "iPhone 未接受记录，请查看首页原因。"
    case .retry: return "已在手表排队，等待 iPhone 确认。"
    }
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

        Text("盆底肌练习并非人人适合。已有盆底疼痛、排尿排便困难或盆底过紧时，先咨询专业人员；术后、孕产期按专业建议安排。")
          .font(.caption2)
          .foregroundStyle(.secondary)
        Text("正常呼吸，向内向上轻提，避免夹臀、夹腿或腹部用力，随后充分放松。疼痛或不适加重时停练。阅读确认仅表示了解操作，不是医学筛查。参数在手机调整。")
          .font(.caption2)
          .foregroundStyle(.secondary)

        ForEach(modes) { mode in
          Button {
            selectedModeId = mode.id
          } label: {
            TrainingModeOption(mode: mode, isSelected: selectedModeId == mode.id)
          }
          .buttonStyle(.plain)
        }

        Button {
          onStart()
        } label: {
          Label("已了解，开始准备", systemImage: "play.fill")
            .font(.headline)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)

        Text("手表记录本组节奏、时间和完成次数，并发送到 iPhone。")
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
        Text(mode.title + (mode.isAdjusted ? " · 已调整" : ""))
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
  var canResume: Bool
  var onCancel: () -> Void
  var onTogglePause: () -> Void
  var onDiscomfort: () -> Void
  var body: some View {
    TimelineView(.periodic(from: session.startedAt, by: 0.2)) { _ in
      let snapshot = session.snapshot()
      ScrollView {
        VStack(spacing: 10) {
          Text(session.isPaused ? "已暂停，请充分放松" : snapshot.phase.title).font(.headline)
          Text(
            session.isPaused || snapshot.remainingSeconds == 0
              ? "—" : "\(snapshot.remainingSeconds)"
          )
          .font(.system(size: 44, weight: .bold, design: .rounded)).monospacedDigit()
          ProgressView(value: snapshot.progress).tint(.green)
          Text("已完成 \(session.completedRepetitions)/\(session.mode.rounds) 次").font(.caption)
          Text(session.isPaused ? "停止收缩，充分放松，正常呼吸。" : "正常呼吸，轻轻提起后充分放松。").font(.caption2)
          if session.interrupted { Text("节奏已中断，不会补记次数。").font(.caption2) }
          if !canResume { Text("旧日期进度或当前权限不可继续，可结束并保留记录。").font(.caption2) }
          Button(session.isPaused ? "继续，先放松" : "暂停") { onTogglePause() }.disabled(
            session.isPaused && !canResume)
          Button("结束本组") { onCancel() }
          Button("因不适停止", role: .destructive) { onDiscomfort() }
        }.padding()
      }
    }
  }
}
