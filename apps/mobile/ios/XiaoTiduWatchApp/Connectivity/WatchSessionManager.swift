import Combine
import Foundation
import WatchConnectivity

final class WatchSessionManager: NSObject, ObservableObject {
  @Published private(set) var isReachable = false
  @Published private(set) var lastAckMessage: String?
  @Published private(set) var lastError: String?
  @Published private(set) var lastSyncedAt: Date?
  @Published private(set) var pendingEventCount = 0
  @Published private(set) var todayState = WatchTodayState.placeholder

  private let session: WCSession? = WCSession.isSupported() ? WCSession.default : nil
  private let maxPendingEvents = 25
  private let pendingEventLifetime: TimeInterval = 24 * 60 * 60
  private let stateStorageKey = "xiaotidu-watch-today-state"
  private let pendingEventsStorageKey = "xiaotidu-watch-pending-events"
  private var pendingEvents: [[String: Any]] = []

  override init() {
    super.init()
    loadPersistedState()
    loadPendingEvents()
    activate()
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
    var payload: [String: Any] = [
      "habitKey": habitKey,
    ]

    if let level {
      payload["level"] = level
    }

    sendEvent(type: "habit_toggled", payload: payload)
  }

  func sendToiletAction(_ action: String, elapsedSeconds: Int) {
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
            self?.lastError = error.localizedDescription
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
      pendingEventCount = pendingEvents.count
      return
    }

    if pendingEvents.count >= maxPendingEvents {
      pendingEvents.removeFirst(pendingEvents.count - maxPendingEvents + 1)
    }

    pendingEvents.append(message)
    pendingEventCount = pendingEvents.count
    persistPendingEvents()
  }

  private func flushPendingEventsIfPossible() {
    purgeExpiredPendingEvents()

    guard let session, session.isReachable, !pendingEvents.isEmpty else {
      return
    }

    let events = pendingEvents
    pendingEvents.removeAll()
    pendingEventCount = 0
    persistPendingEvents()

    for event in events {
      sendOrQueue(event)
    }
  }

  private func handleReply(_ reply: [String: Any]) {
    let status = reply["status"] as? String
    let message = reply["message"] as? String

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
      lastError = nil
    }
  }

  private func updateState(from payload: [String: Any]) {
    let rawState = payload["state"] as? [String: Any] ?? payload

    guard JSONSerialization.isValidJSONObject(rawState),
          let data = try? JSONSerialization.data(withJSONObject: rawState),
          let decoded = try? JSONDecoder().decode(WatchTodayState.self, from: data) else {
      lastError = "手表收到的今日状态格式不对。"
      return
    }

    todayState = decoded
    lastError = nil
    lastSyncedAt = Date()
    persistTodayState()
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
      replyHandler: { [weak self] _ in
        DispatchQueue.main.async {
          self?.lastError = nil
        }
      },
      errorHandler: { [weak self] error in
        DispatchQueue.main.async {
          self?.lastError = error.localizedDescription
        }
      }
    )
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
    pendingEventCount = pendingEvents.count
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

    pendingEventCount = pendingEvents.count
    persistPendingEvents()
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
      self.lastError = error?.localizedDescription
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

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    DispatchQueue.main.async {
      self.updateState(from: message)
    }
  }
}
