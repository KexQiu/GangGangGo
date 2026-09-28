import Combine
import Foundation

@MainActor
final class WatchSessionManager: ObservableObject {
  @Published private(set) var isApplicationActive = true
  @Published private(set) var isReachable = false
  @Published private(set) var lastAckMessage: String?
  @Published private(set) var lastError: String?
  @Published private(set) var lastSyncedAt: Date?
  @Published private(set) var pendingEventCount = 0
  @Published private(set) var pendingEventSummaries: [String] = []
  @Published private(set) var trainingDelivery:
    (eventId: String, disposition: WatchDeliveryDisposition)?
  @Published private(set) var todayState: WatchTodayState

  private let connectivityClient: WatchConnectivityClient
  private let eventQueue: WatchOfflineEventQueue
  private let stateStore: WatchStateStore
  private var refreshBackoff = WatchRefreshBackoff()
  private var stateRefreshTask: Task<Void, Never>?
  private var isResolvingDelivery = false
  private var deliveryBackoff = WatchRefreshBackoff()
  private var deliveryRetryTask: Task<Void, Never>?
  private var deliveryAttempts: [String: UUID] = [:]
  private var deliveryTimeouts: [String: Task<Void, Never>] = [:]

  init(
    connectivityClient: WatchConnectivityClient = WatchConnectivityClient(),
    eventQueue: WatchOfflineEventQueue = WatchOfflineEventQueue(),
    stateStore: WatchStateStore = WatchStateStore()
  ) {
    self.connectivityClient = connectivityClient
    self.eventQueue = eventQueue
    self.stateStore = stateStore
    todayState = stateStore.load()

    bindConnectivityClient()
    activate()
    refreshPendingEventState()
  }

  func activate() {
    guard connectivityClient.isSupported else {
      lastError = "这块表暂时不支持 WatchConnectivity。"
      return
    }

    connectivityClient.activate()
    isReachable = connectivityClient.isReachable
    requestLatestStateIfPossible()
  }

  func setApplicationActive(_ isActive: Bool) {
    isApplicationActive = isActive
    cancelStateRefreshRetry()
    deliveryRetryTask?.cancel()
    deliveryRetryTask = nil

    guard isActive else {
      return
    }

    refreshBackoff.reset()
    requestLatestStateIfPossible()
    flushPendingEventsIfPossible()
  }

  func sendTrainingCompleted(owner: WatchEventOwner, mode: String, completedSets: Int, durationSeconds: Int) -> String? {
    guard ensureActionAllowed() else { return nil }
    guard owner == todayState.account.owner else {
      lastError = "账号已变更，这组训练未写入新账号。"
      return nil
    }

    let event = WatchOutboundEvent.trainingCompleted(
      owner: owner,
      mode: mode,
      completedSets: completedSets,
      durationSeconds: durationSeconds
    )
    trainingDelivery = (event.id, .retry)
    sendOrQueue(event)
    return event.id
  }

  func sendHabitToggle(habitKey: String, level: String?) {
    guard ensureActionAllowed(), let owner = todayState.account.owner else {
      return
    }

    applyHabitToggle(habitKey: habitKey, isDone: level != nil)
    sendOrQueue(.habitToggled(owner: owner, habitKey: habitKey, level: level))
  }

  func sendToiletAction(_ action: String, elapsedSeconds: Int) {
    guard ensureActionAllowed(), let owner = todayState.account.owner else {
      return
    }

    guard let sessionId = todayState.toilet.sessionId else {
      lastError = "请先同步当前计时。"
      return
    }
    sendOrQueue(
      .toiletTimerAction(
        owner: owner, sessionId: sessionId, action: action, elapsedSeconds: elapsedSeconds))
  }

  private func bindConnectivityClient() {
    connectivityClient.onActivationCompleted = { [weak self] error in
      Task { @MainActor [weak self] in
        self?.handleActivationCompleted(error: error)
      }
    }

    connectivityClient.onReachabilityChanged = { [weak self] isReachable in
      Task { @MainActor [weak self] in
        self?.handleReachabilityChanged(isReachable)
      }
    }

    connectivityClient.onPayloadReceived = { [weak self] payload in
      Task { @MainActor [weak self] in
        self?.updateState(from: payload)
      }
    }
  }

  private func handleActivationCompleted(error: Error?) {
    isReachable = connectivityClient.isReachable
    lastError = error.map(friendlyConnectivityMessage)
    flushPendingEventsIfPossible()
    requestLatestStateIfPossible()
  }

  private func handleReachabilityChanged(_ reachable: Bool) {
    isReachable = reachable

    guard reachable else {
      if isApplicationActive {
        scheduleStateRefreshRetry()
      }
      return
    }

    flushPendingEventsIfPossible()
    requestLatestStateIfPossible()
  }

  private func sendOrQueue(_ event: WatchOutboundEvent) {
    // 实时发送同样先持久化，ACK 丢失或进程退出后仍可重放。
    Task { [weak self, eventQueue] in
      let snapshot = await eventQueue.enqueue(event)
      self?.applyPendingSnapshot(snapshot)
      self?.flushPendingEventsIfPossible()
    }
  }

  private func deliver(_ event: WatchOutboundEvent) {
    guard let message = event.messageDictionary else {
      finishDelivery(event, disposition: .retry, message: "手表操作暂时无法编码。")
      return
    }
    let attempt = UUID()
    deliveryAttempts[event.id] = attempt
    deliveryTimeouts[event.id] = Task { @MainActor [weak self] in
      do { try await Task.sleep(for: .seconds(15)) } catch { return }
      self?.handleDeliveryResult(
        .failure(
          NSError(
            domain: "WatchDelivery", code: 1,
            userInfo: [NSLocalizedDescriptionKey: "同步超时，操作已保留，稍后重试。"])), event: event,
        attempt: attempt)
    }
    connectivityClient.sendMessage(message) { [weak self] result in
      Task { @MainActor [weak self] in
        self?.handleDeliveryResult(result, event: event, attempt: attempt)
      }
    }
  }

  private func handleDeliveryResult(
    _ result: Result<[String: Any], Error>, event: WatchOutboundEvent, attempt: UUID
  ) {
    guard deliveryAttempts[event.id] == attempt else { return }
    deliveryAttempts.removeValue(forKey: event.id)
    deliveryTimeouts.removeValue(forKey: event.id)?.cancel()
    switch result {
    case .success(let reply):
      let disposition = WatchDeliveryDisposition.classify(reply, eventId: event.id)
      if reply["eventId"] as? String == event.id && event.event.owner == todayState.account.owner {
        _ = updateStateIfPresent(in: reply, replay: false)
      }
      finishDelivery(event, disposition: disposition, message: reply["message"] as? String)
    case .failure(let error):
      finishDelivery(event, disposition: .retry, message: friendlyConnectivityMessage(for: error))
    }
  }

  private func finishDelivery(
    _ event: WatchOutboundEvent, disposition: WatchDeliveryDisposition, message: String?
  ) {
    isResolvingDelivery = true
    Task { [weak self, eventQueue] in
      let snapshot = await eventQueue.resolve(eventId: event.id, disposition: disposition)
      guard let self else { return }
      applyPendingSnapshot(snapshot)
      if trainingDelivery?.eventId == event.id { trainingDelivery = (event.id, disposition) }
      switch disposition {
      case .accepted, .duplicate:
        lastAckMessage = disposition == .accepted ? "iPhone 已保存。" : "这条记录已经保存过。"
        lastError = nil
        deliveryBackoff.reset()
      case .rejected:
        lastAckMessage = nil
        lastError = message ?? "这条操作未保存，已停止重试。"
        deliveryBackoff.reset()
      case .retry:
        lastAckMessage = nil
        lastError = message ?? "尚未确认保存，操作已保留，稍后重试。"
        scheduleDeliveryRetry()
      }
      isResolvingDelivery = false
      if disposition != .retry { flushPendingEventsIfPossible() }
    }
  }

  private func scheduleDeliveryRetry() {
    guard deliveryRetryTask == nil,
      let delay = deliveryBackoff.takeNextDelay(isApplicationActive: isApplicationActive)
    else { return }
    deliveryRetryTask = Task { @MainActor [weak self] in
      do { try await Task.sleep(for: .seconds(delay)) } catch { return }
      guard let self else { return }
      deliveryRetryTask = nil
      flushPendingEventsIfPossible()
    }
  }

  private func flushPendingEventsIfPossible() {
    guard connectivityClient.isReadyToSend, deliveryRetryTask == nil, !isResolvingDelivery,
      deliveryAttempts.isEmpty
    else { return }
    let owner = todayState.account.owner
    let allowDelivery = todayState.account.isLoggedIn && todayState.canUseActions
    Task { [weak self, eventQueue] in
      guard let self, !isResolvingDelivery, deliveryRetryTask == nil, deliveryAttempts.isEmpty
      else { return }
      let batch = await eventQueue.beginReplay(allowDelivery: allowDelivery, owner: owner)
      applyPendingSnapshot(batch.snapshot)
      for event in batch.events { deliver(event) }
    }
  }

  private func refreshPendingEventState() {
    Task { [weak self, eventQueue] in
      let snapshot = await eventQueue.snapshot()
      self?.applyPendingSnapshot(snapshot)
    }
  }

  private func applyPendingSnapshot(_ snapshot: WatchPendingQueueSnapshot) {
    pendingEventCount = snapshot.count
    pendingEventSummaries = snapshot.summaries
  }

  @discardableResult
  private func updateState(from payload: [String: Any], replay: Bool = true) -> Bool {
    let decodedState: WatchTodayState?

    if let stateJson = payload["stateJson"] as? String,
      let data = stateJson.data(using: .utf8)
    {
      decodedState = try? JSONDecoder().decode(WatchTodayState.self, from: data)
    } else {
      let rawState = dictionaryValue(payload["state"]) ?? payload
      if JSONSerialization.isValidJSONObject(rawState),
        let data = try? JSONSerialization.data(withJSONObject: rawState)
      {
        decodedState = try? JSONDecoder().decode(WatchTodayState.self, from: data)
      } else {
        decodedState = nil
      }
    }

    guard let decodedState else {
      lastError = "手表收到的今日状态格式不对。"
      return false
    }

    // Applies to unsolicited state, refresh replies and ACK snapshots alike.
    guard decodedState.revision > todayState.revision else { return false }

    todayState = decodedState
    refreshBackoff.reset()
    cancelStateRefreshRetry()
    lastError = nil
    lastSyncedAt = Date()
    stateStore.save(todayState)
    if replay { flushPendingEventsIfPossible() }
    return true
  }

  private func updateStateIfPresent(in payload: [String: Any], replay: Bool = true) -> Bool {
    guard payload["stateJson"] is String || dictionaryValue(payload["state"]) != nil else {
      return false
    }

    return updateState(from: payload, replay: replay)
  }

  private func dictionaryValue(_ value: Any?) -> [String: Any]? {
    if let dictionary = value as? [String: Any] {
      return dictionary
    }

    if let dictionary = value as? NSDictionary {
      var result: [String: Any] = [:]
      for (key, value) in dictionary {
        guard let key = key as? String else {
          continue
        }
        result[key] = value
      }
      return result
    }

    return nil
  }

  private func requestLatestStateIfPossible() {
    guard isApplicationActive else {
      return
    }

    guard connectivityClient.isReadyToSend else {
      scheduleStateRefreshRetry()
      return
    }

    connectivityClient.sendMessage(
      [
        "requestedAt": ISO8601DateFormatter().string(from: Date()),
        "type": "request_today_state",
      ]
    ) { [weak self] result in
      Task { @MainActor [weak self] in
        guard let self else {
          return
        }

        switch result {
        case .success(let reply):
          if !updateStateIfPresent(in: reply) {
            lastError = nil
          }
          refreshBackoff.reset()
          cancelStateRefreshRetry()
        case .failure(let error):
          lastError = friendlyConnectivityMessage(for: error)
          scheduleStateRefreshRetry()
        }
      }
    }
  }

  private func scheduleStateRefreshRetry() {
    guard let delay = refreshBackoff.takeNextDelay(isApplicationActive: isApplicationActive) else {
      return
    }

    cancelStateRefreshRetry()

    stateRefreshTask = Task { @MainActor [weak self] in
      do {
        try await Task.sleep(for: .seconds(delay))
      } catch {
        return
      }

      guard let self, isApplicationActive else {
        return
      }

      stateRefreshTask = nil
      requestLatestStateIfPossible()
    }
  }

  private func cancelStateRefreshRetry() {
    stateRefreshTask?.cancel()
    stateRefreshTask = nil
  }

  private func friendlyConnectivityMessage(for error: Error) -> String {
    let message = error.localizedDescription

    if message.localizedCaseInsensitiveContains("not reachable") {
      return "打开 iPhone 上的小提督，再到「我的」里的 Apple Watch 页面点同步。"
    }

    if message.localizedCaseInsensitiveContains("not paired") {
      return "还没有找到配对的 Apple Watch。"
    }

    return message
  }

  private func ensureActionAllowed() -> Bool {
    guard todayState.account.isLoggedIn else {
      lastAckMessage = nil
      lastError = "先在 iPhone 上登录小提督。"
      return false
    }

    guard todayState.canUseActions else {
      lastAckMessage = nil
      lastError = todayState.actionLockedBody
      return false
    }

    return true
  }

  private func applyHabitToggle(habitKey: String, isDone: Bool) {
    switch habitKey {
    case "water":
      todayState.habits.waterDone = isDone
    case "fiber":
      todayState.habits.fiberDone = isDone
    case "movement":
      todayState.habits.movementDone = isDone
    case "bowel":
      todayState.habits.bowelDone = isDone
    default:
      return
    }

    todayState.habits.completion =
      [
        todayState.habits.waterDone,
        todayState.habits.fiberDone,
        todayState.habits.movementDone,
        todayState.habits.bowelDone,
      ].filter { $0 }.count
    todayState.generatedAt = ISO8601DateFormatter().string(from: Date())
    stateStore.save(todayState)
  }
}
