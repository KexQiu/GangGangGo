import Combine
import Foundation
import WatchConnectivity

final class WatchSessionManager: NSObject, ObservableObject {
  @Published private(set) var isReachable = false
  @Published private(set) var lastAckMessage: String?
  @Published private(set) var lastError: String?
  @Published private(set) var lastSyncedAt: Date?
  @Published private(set) var pendingEventCount = 0
  @Published private(set) var pendingEventSummaries: [String] = []
  @Published private(set) var todayState = WatchTodayState.placeholder

  private let session: WCSession? = WCSession.isSupported() ? WCSession.default : nil
  private let maxPendingEvents = 25
  private let pendingEventLifetime: TimeInterval = 24 * 60 * 60
  private let stateStorageKey = "xiaotidu-watch-today-state"
  private let pendingEventsStorageKey = "xiaotidu-watch-pending-events"
  private var pendingEvents: [[String: Any]] = []
  private var stateRefreshTimer: Timer?

  override init() {
    super.init()
    loadPersistedState()
    loadPendingEvents()
    activate()
    startStateRefreshTimer()
  }

  deinit {
    stateRefreshTimer?.invalidate()
  }

  func activate() {
    guard let session else {
      lastError = "这块表暂时不支持 WatchConnectivity。"
      return
    }

    session.delegate = self
    session.activate()
    isReachable = session.isReachable
    requestLatestStateIfPossible()
  }

  func sendTrainingCompleted(mode: String, completedSets: Int, durationSeconds: Int) {
    sendEvent(
      type: "training_completed",
      payload: [
        "completedSets": completedSets,
        "durationSeconds": durationSeconds,
        "mode": mode,
      ]
    )
  }

  func sendHabitToggle(habitKey: String, level: String?) {
    applyHabitToggle(habitKey: habitKey, isDone: level != nil)
    var payload: [String: Any] = [
      "habitKey": habitKey,
    ]

    if let level {
      payload["level"] = level
    }

    sendEvent(type: "habit_toggled", payload: payload)
  }

  func sendToiletAction(_ action: String, elapsedSeconds: Int) {
    guard todayState.isPro else {
      lastAckMessage = nil
      lastError = "蹲会儿计时同步需要小提督 Pro。"
      return
    }

    sendEvent(
      type: "toilet_timer_action",
      payload: [
        "action": action,
        "elapsedSeconds": elapsedSeconds,
      ]
    )
  }

  private func sendEvent(type: String, payload: [String: Any]) {
    let event: [String: Any] = [
      "createdAt": ISO8601DateFormatter().string(from: Date()),
      "id": UUID().uuidString,
      "payload": payload,
      "type": type,
    ]
    let message: [String: Any] = [
      "event": event,
      "type": "watch_event",
    ]

    sendOrQueue(message)
  }

  private func sendOrQueue(_ message: [String: Any]) {
    guard let session else {
      queue(message)
      return
    }

    if session.isReachable {
      session.sendMessage(
        message,
        replyHandler: { [weak self] reply in
          DispatchQueue.main.async {
            self?.handleReply(reply)
          }
        },
        errorHandler: { [weak self] error in
          DispatchQueue.main.async {
            self?.lastError = self?.friendlyConnectivityMessage(for: error)
            self?.queue(message)
          }
        }
      )
      return
    }

    queue(message)
  }

  private func queue(_ message: [String: Any]) {
    purgeExpiredPendingEvents()

    if let eventId = eventId(from: message), pendingEvents.contains(where: { self.eventId(from: $0) == eventId }) {
      refreshPendingEventState()
      return
    }

    if pendingEvents.count >= maxPendingEvents {
      pendingEvents.removeFirst(pendingEvents.count - maxPendingEvents + 1)
    }

    pendingEvents.append(message)
    refreshPendingEventState()
    persistPendingEvents()
  }

  private func flushPendingEventsIfPossible() {
    purgeExpiredPendingEvents()

    guard let session, session.isReachable, !pendingEvents.isEmpty else {
      return
    }

    let events = pendingEvents
    pendingEvents.removeAll()
    refreshPendingEventState()
    persistPendingEvents()

    for event in events {
      sendOrQueue(event)
    }
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
    if let stateJson = payload["stateJson"] as? String,
       let data = stateJson.data(using: .utf8),
       let decoded = try? JSONDecoder().decode(WatchTodayState.self, from: data) {
      todayState = decoded
      lastError = nil
      lastSyncedAt = Date()
      persistTodayState()
      return true
    }

    let rawState = dictionaryValue(payload["state"]) ?? payload

    guard JSONSerialization.isValidJSONObject(rawState),
          let data = try? JSONSerialization.data(withJSONObject: rawState),
          let decoded = try? JSONDecoder().decode(WatchTodayState.self, from: data) else {
      lastError = "手表收到的今日状态格式不对。"
      return false
    }

    todayState = decoded
    lastError = nil
    lastSyncedAt = Date()
    persistTodayState()
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
    guard let session, session.activationState == .activated, session.isReachable else {
      return
    }

    session.sendMessage(
      [
        "requestedAt": ISO8601DateFormatter().string(from: Date()),
        "type": "request_today_state",
      ],
      replyHandler: { [weak self] reply in
        DispatchQueue.main.async {
          if self?.updateStateIfPresent(in: reply) != true {
            self?.lastError = nil
          }
        }
      },
      errorHandler: { [weak self] error in
        DispatchQueue.main.async {
          self?.lastError = self?.friendlyConnectivityMessage(for: error)
        }
      }
    )
  }

  private func startStateRefreshTimer() {
    stateRefreshTimer?.invalidate()
    stateRefreshTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
      DispatchQueue.main.async {
        self?.requestLatestStateIfPossible()
      }
    }
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

  private func loadPersistedState() {
    guard let data = UserDefaults.standard.data(forKey: stateStorageKey),
          let state = try? JSONDecoder().decode(WatchTodayState.self, from: data) else {
      return
    }

    todayState = state
  }

  private func persistTodayState() {
    guard let data = try? JSONEncoder().encode(todayState) else {
      return
    }

    UserDefaults.standard.set(data, forKey: stateStorageKey)
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
    persistTodayState()
  }

  private func loadPendingEvents() {
    guard let encodedMessages = UserDefaults.standard.stringArray(forKey: pendingEventsStorageKey) else {
      pendingEventCount = 0
      return
    }

    pendingEvents = encodedMessages.compactMap { encodedMessage in
      guard let data = encodedMessage.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data),
            let message = object as? [String: Any] else {
        return nil
      }

      return message
    }

    purgeExpiredPendingEvents()
    refreshPendingEventState()
  }

  private func persistPendingEvents() {
    let encodedMessages = pendingEvents.compactMap { message -> String? in
      guard JSONSerialization.isValidJSONObject(message),
            let data = try? JSONSerialization.data(withJSONObject: message),
            let encoded = String(data: data, encoding: .utf8) else {
        return nil
      }

      return encoded
    }

    UserDefaults.standard.set(encodedMessages, forKey: pendingEventsStorageKey)
  }

  private func purgeExpiredPendingEvents() {
    let now = Date()
    pendingEvents = pendingEvents.filter { message in
      guard let createdAt = eventCreatedAt(from: message) else {
        return false
      }

      return now.timeIntervalSince(createdAt) <= pendingEventLifetime
    }

    if pendingEvents.count > maxPendingEvents {
      pendingEvents.removeFirst(pendingEvents.count - maxPendingEvents)
    }

    refreshPendingEventState()
    persistPendingEvents()
  }

  private func refreshPendingEventState() {
    pendingEventCount = pendingEvents.count
    pendingEventSummaries = pendingEvents.compactMap { summary(from: $0) }
  }

  private func summary(from message: [String: Any]) -> String? {
    guard let event = message["event"] as? [String: Any],
          let type = event["type"] as? String else {
      return nil
    }

    switch type {
    case "training_completed":
      return "菊花抬完成待同步"
    case "habit_toggled":
      guard let payload = event["payload"] as? [String: Any],
            let habitKey = payload["habitKey"] as? String else {
        return "小账本待同步"
      }
      return "\(habitTitle(for: habitKey))待同步"
    case "toilet_timer_action":
      guard let payload = event["payload"] as? [String: Any],
            let action = payload["action"] as? String else {
        return "蹲会儿操作待同步"
      }
      return "\(toiletActionTitle(for: action))待同步"
    default:
      return "待同步事件"
    }
  }

  private func habitTitle(for key: String) -> String {
    switch key {
    case "water":
      return "喝水"
    case "fiber":
      return "纤维"
    case "movement":
      return "活动"
    case "bowel":
      return "顺畅"
    default:
      return "小账本"
    }
  }

  private func toiletActionTitle(for action: String) -> String {
    switch action {
    case "pause":
      return "蹲会儿暂停"
    case "resume":
      return "蹲会儿继续"
    case "finish":
      return "蹲会儿收工"
    default:
      return "蹲会儿"
    }
  }

  private func eventId(from message: [String: Any]) -> String? {
    guard let event = message["event"] as? [String: Any] else {
      return nil
    }

    return event["id"] as? String
  }

  private func eventCreatedAt(from message: [String: Any]) -> Date? {
    guard let event = message["event"] as? [String: Any],
          let createdAt = event["createdAt"] as? String else {
      return nil
    }

    return ISO8601DateFormatter().date(from: createdAt)
  }
}

extension WatchSessionManager: WCSessionDelegate {
  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    DispatchQueue.main.async {
      self.isReachable = session.isReachable
      self.lastError = error.map { self.friendlyConnectivityMessage(for: $0) }
      self.flushPendingEventsIfPossible()
      self.requestLatestStateIfPossible()
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    DispatchQueue.main.async {
      self.isReachable = session.isReachable
      self.flushPendingEventsIfPossible()
      self.requestLatestStateIfPossible()
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    DispatchQueue.main.async {
      self.updateState(from: applicationContext)
    }
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    DispatchQueue.main.async {
      self.updateState(from: userInfo)
    }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    DispatchQueue.main.async {
      self.updateState(from: message)
    }
  }
}
