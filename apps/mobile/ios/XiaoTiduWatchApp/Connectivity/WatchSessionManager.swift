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
  @Published private(set) var todayState: WatchTodayState

  private let connectivityClient: WatchConnectivityClient
  private let eventQueue: WatchOfflineEventQueue
  private let stateStore: WatchStateStore
  private var refreshBackoff = WatchRefreshBackoff()
  private var stateRefreshTask: Task<Void, Never>?

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

    guard isActive else {
      return
    }

    refreshBackoff.reset()
    requestLatestStateIfPossible()
    flushPendingEventsIfPossible()
  }

  func sendTrainingCompleted(mode: String, completedSets: Int, durationSeconds: Int) {
    guard ensureProActionAllowed() else {
      return
    }

    sendOrQueue(
      .trainingCompleted(
        mode: mode,
        completedSets: completedSets,
        durationSeconds: durationSeconds
      )
    )
  }

  func sendHabitToggle(habitKey: String, level: String?) {
    guard ensureProActionAllowed() else {
      return
    }

    applyHabitToggle(habitKey: habitKey, isDone: level != nil)
    sendOrQueue(.habitToggled(habitKey: habitKey, level: level))
  }

  func sendToiletAction(_ action: String, elapsedSeconds: Int) {
    guard ensureProActionAllowed() else {
      return
    }

    sendOrQueue(.toiletTimerAction(action: action, elapsedSeconds: elapsedSeconds))
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
    guard connectivityClient.isReadyToSend else {
      queue(event)
      return
    }

    deliver(event, isReplay: false)
  }

  private func deliver(_ event: WatchOutboundEvent, isReplay: Bool) {
    guard let message = event.messageDictionary else {
      lastAckMessage = nil
      lastError = "手表操作暂时无法编码。"
      if isReplay {
        markDeliveryFailed(eventId: event.id)
      }
      return
    }

    connectivityClient.sendMessage(message) { [weak self] result in
      Task { @MainActor [weak self] in
        self?.handleDeliveryResult(result, event: event, isReplay: isReplay)
      }
    }
  }

  private func handleDeliveryResult(
    _ result: Result<[String: Any], Error>,
    event: WatchOutboundEvent,
    isReplay: Bool
  ) {
    switch result {
    case let .success(reply):
      handleReply(reply)
      if isReplay {
        acknowledge(eventId: event.id)
      }
    case let .failure(error):
      lastError = friendlyConnectivityMessage(for: error)
      if isReplay {
        markDeliveryFailed(eventId: event.id)
      } else {
        queue(event)
      }
    }
  }

  private func queue(_ event: WatchOutboundEvent) {
    Task { [weak self, eventQueue] in
      let snapshot = await eventQueue.enqueue(event)
      self?.applyPendingSnapshot(snapshot)
    }
  }

  private func flushPendingEventsIfPossible() {
    guard connectivityClient.isReadyToSend else {
      return
    }

    let allowDelivery = todayState.account.isLoggedIn && todayState.isPro
    Task { [weak self, eventQueue] in
      let batch = await eventQueue.beginReplay(allowDelivery: allowDelivery)
      guard let self else {
        return
      }

      applyPendingSnapshot(batch.snapshot)
      if batch.removedUnauthorizedCount > 0 {
        lastAckMessage = nil
        lastError = "Pro 状态暂停，未继续同步 \(batch.removedUnauthorizedCount) 条手表操作。"
      }

      for event in batch.events {
        deliver(event, isReplay: true)
      }
    }
  }

  private func acknowledge(eventId: String) {
    Task { [weak self, eventQueue] in
      let snapshot = await eventQueue.acknowledge(eventId: eventId)
      self?.applyPendingSnapshot(snapshot)
    }
  }

  private func markDeliveryFailed(eventId: String) {
    Task { [weak self, eventQueue] in
      let snapshot = await eventQueue.deliveryFailed(eventId: eventId)
      self?.applyPendingSnapshot(snapshot)
    }
  }

  private func refreshPendingEventState() {
    Task { [weak self, eventQueue] in
      let snapshot = await eventQueue.snapshot()
      self?.applyPendingSnapshot(snapshot)
    }
  }

  private func prunePendingEventsForCurrentState() {
    let allowDelivery = todayState.account.isLoggedIn && todayState.isPro
    Task { [weak self, eventQueue] in
      let (snapshot, removedCount) = await eventQueue.pruneForAuthorization(allowDelivery: allowDelivery)
      guard let self else {
        return
      }

      applyPendingSnapshot(snapshot)
      if removedCount > 0 {
        lastAckMessage = nil
        lastError = "Pro 状态暂停，未继续同步 \(removedCount) 条手表操作。"
      }
    }
  }

  private func applyPendingSnapshot(_ snapshot: WatchPendingQueueSnapshot) {
    pendingEventCount = snapshot.count
    pendingEventSummaries = snapshot.summaries
  }

  private func handleReply(_ reply: [String: Any]) {
    let status = reply["status"] as? String
    let message = reply["message"] as? String
    let didUpdateState = updateStateIfPresent(in: reply)

    switch status {
    case "accepted":
      lastAckMessage = "iPhone 已同步。"
      lastError = nil
    case "duplicate":
      lastAckMessage = "这条记录已经同步过。"
      lastError = nil
    case "rejected":
      lastAckMessage = nil
      lastError = message ?? "iPhone 暂时没有接住这次操作。"
    default:
      lastAckMessage = nil
      if !didUpdateState {
        lastError = nil
      }
    }
  }

  @discardableResult
  private func updateState(from payload: [String: Any]) -> Bool {
    let decodedState: WatchTodayState?

    if let stateJson = payload["stateJson"] as? String,
       let data = stateJson.data(using: .utf8) {
      decodedState = try? JSONDecoder().decode(WatchTodayState.self, from: data)
    } else {
      let rawState = dictionaryValue(payload["state"]) ?? payload
      if JSONSerialization.isValidJSONObject(rawState),
         let data = try? JSONSerialization.data(withJSONObject: rawState) {
        decodedState = try? JSONDecoder().decode(WatchTodayState.self, from: data)
      } else {
        decodedState = nil
      }
    }

    guard let decodedState else {
      lastError = "手表收到的今日状态格式不对。"
      return false
    }

    todayState = decodedState
    refreshBackoff.reset()
    cancelStateRefreshRetry()
    lastError = nil
    lastSyncedAt = Date()
    stateStore.save(todayState)
    prunePendingEventsForCurrentState()
    flushPendingEventsIfPossible()
    return true
  }

  private func updateStateIfPresent(in payload: [String: Any]) -> Bool {
    guard payload["stateJson"] is String || dictionaryValue(payload["state"]) != nil else {
      return false
    }

    return updateState(from: payload)
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
        case let .success(reply):
          if !updateStateIfPresent(in: reply) {
            lastError = nil
          }
          refreshBackoff.reset()
          cancelStateRefreshRetry()
        case let .failure(error):
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

  private func ensureProActionAllowed() -> Bool {
    guard todayState.account.isLoggedIn else {
      lastAckMessage = nil
      lastError = "先在 iPhone 上登录小提督。"
      return false
    }

    guard todayState.isPro else {
      lastAckMessage = nil
      lastError = proLockedMessage
      return false
    }

    return true
  }

  private var proLockedMessage: String {
    if todayState.proStatus == "pro_expired" {
      return "小提督 Pro 已暂停，请在 iPhone 上恢复后再使用手表联动。"
    }

    return "Apple Watch 联动属于小提督 Pro。"
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

    todayState.habits.completion = [
      todayState.habits.waterDone,
      todayState.habits.fiberDone,
      todayState.habits.movementDone,
      todayState.habits.bowelDone,
    ].filter { $0 }.count
    todayState.generatedAt = ISO8601DateFormatter().string(from: Date())
    stateStore.save(todayState)
  }
}
