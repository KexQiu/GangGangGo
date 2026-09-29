import Foundation

struct WatchOutboundEvent: Codable, Equatable, Sendable {
  struct Event: Codable, Equatable, Sendable {
    var owner: WatchEventOwner
    var createdAt: String
    var id: String
    var payload: Payload
    var schemaVersion: Int
    var type: String
  }

  struct Payload: Codable, Equatable, Sendable {
    var action: String?
    var session: WatchTrainingRecord?
    var elapsedSeconds: Int?
    var habitKey: String?
    var level: String?
    var sessionId: String?

    init(
      action: String? = nil,
      session: WatchTrainingRecord? = nil,
      elapsedSeconds: Int? = nil,
      habitKey: String? = nil,
      level: String? = nil,
      sessionId: String? = nil
    ) {
      self.action = action
      self.session = session
      self.elapsedSeconds = elapsedSeconds
      self.habitKey = habitKey
      self.level = level
      self.sessionId = sessionId
    }
  }

  var event: Event
  var schemaVersion: Int
  var type: String

  var id: String {
    event.id
  }

  var messageDictionary: [String: Any]? {
    guard let data = try? JSONEncoder().encode(self),
      let object = try? JSONSerialization.jsonObject(with: data)
    else {
      return nil
    }

    return object as? [String: Any]
  }

  var summary: String {
    switch event.type {
    case "training_finished":
      return "菊花抬记录待同步"
    case "habit_toggled":
      return "\(habitTitle(for: event.payload.habitKey))待同步"
    case "toilet_timer_action":
      return "\(toiletActionTitle(for: event.payload.action))待同步"
    default:
      return "待同步事件"
    }
  }

  static func trainingFinished(owner: WatchEventOwner, session: WatchTrainingRecord)
    -> WatchOutboundEvent
  {
    var event = make(owner: owner, type: "training_finished", payload: Payload(session: session))
    event.event.id = session.id
    event.event.createdAt = session.endedAt
    return event
  }

  static func habitToggled(owner: WatchEventOwner, habitKey: String, level: String?)
    -> WatchOutboundEvent
  {
    make(owner: owner, type: "habit_toggled", payload: Payload(habitKey: habitKey, level: level))
  }

  static func toiletTimerAction(
    owner: WatchEventOwner, sessionId: String, action: String, elapsedSeconds: Int
  ) -> WatchOutboundEvent {
    make(
      owner: owner,
      type: "toilet_timer_action",
      payload: Payload(action: action, elapsedSeconds: elapsedSeconds, sessionId: sessionId)
    )
  }

  private static func make(owner: WatchEventOwner, type: String, payload: Payload)
    -> WatchOutboundEvent
  {
    WatchOutboundEvent(
      event: Event(
        owner: owner,
        createdAt: ISO8601DateFormatter().string(from: Date()),
        id: UUID().uuidString,
        payload: payload,
        schemaVersion: 4,
        type: type
      ),
      schemaVersion: 4,
      type: "watch_event"
    )
  }

  private func habitTitle(for key: String?) -> String {
    switch key {
    case "water":
      return "喝水"
    case "fiber":
      return "蔬果全谷"
    case "movement":
      return "活动"
    case "bowel":
      return "排便"
    default:
      return "小账本"
    }
  }

  private func toiletActionTitle(for action: String?) -> String {
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
}

struct WatchPendingQueueSnapshot: Equatable, Sendable {
  var count: Int
  var summaries: [String]
}

struct WatchPendingReplayBatch: Sendable {
  var events: [WatchOutboundEvent]
  var snapshot: WatchPendingQueueSnapshot
}

actor WatchOfflineEventQueue {
  private let maxPendingEvents = 25
  private let pendingEventLifetime: TimeInterval = 24 * 60 * 60
  private let storageKey = "xiaotidu-watch-pending-events"
  private let defaults: UserDefaults
  private var events: [WatchOutboundEvent]
  private var inFlightEventIds = Set<String>()

  init(defaults: UserDefaults = .standard) {
    self.defaults = defaults
    Self.migrateStoredEvents(defaults: defaults, storageKey: storageKey)
    events = Self.loadEvents(defaults: defaults, storageKey: storageKey)
  }

  func snapshot(now: Date = Date()) -> WatchPendingQueueSnapshot {
    purgeExpiredEvents(now: now)
    persist()
    return makeSnapshot()
  }

  func enqueue(_ event: WatchOutboundEvent, now: Date = Date()) -> WatchPendingQueueSnapshot {
    purgeExpiredEvents(now: now)

    if !events.contains(where: { $0.id == event.id }) {
      if events.count >= maxPendingEvents {
        let removalCount = events.count - maxPendingEvents + 1
        let removedIds = Set(events.prefix(removalCount).map(\.id))
        events.removeFirst(removalCount)
        inFlightEventIds.subtract(removedIds)
      }

      events.append(event)
    }

    persist()
    return makeSnapshot()
  }

  func beginReplay(allowDelivery: Bool, owner: WatchEventOwner?, now: Date = Date())
    -> WatchPendingReplayBatch
  {
    purgeExpiredEvents(now: now)

    guard allowDelivery, owner != nil, inFlightEventIds.isEmpty else {
      persist()
      return WatchPendingReplayBatch(events: [], snapshot: makeSnapshot())
    }
    // 串行发送，失败的旧习惯更新不能晚于新操作写回。
    let readyEvents = Array(events.filter { $0.event.owner == owner }.prefix(1))
    inFlightEventIds.formUnion(readyEvents.map(\.id))
    persist()

    return WatchPendingReplayBatch(
      events: readyEvents,
      snapshot: makeSnapshot()
    )
  }

  func acknowledge(eventId: String) -> WatchPendingQueueSnapshot {
    events.removeAll { $0.id == eventId }
    inFlightEventIds.remove(eventId)
    persist()
    return makeSnapshot()
  }

  func deliveryFailed(eventId: String) -> WatchPendingQueueSnapshot {
    inFlightEventIds.remove(eventId)
    return makeSnapshot()
  }

  func resolve(eventId: String, disposition: WatchDeliveryDisposition) -> WatchPendingQueueSnapshot
  {
    switch disposition {
    case .accepted, .duplicate, .rejected:
      return acknowledge(eventId: eventId)
    case .retry:
      return deliveryFailed(eventId: eventId)
    }
  }

  private func purgeExpiredEvents(now: Date) {
    let formatter = ISO8601DateFormatter()
    let retainedEvents = events.filter { event in
      guard let createdAt = formatter.date(from: event.event.createdAt) else {
        return false
      }

      return now.timeIntervalSince(createdAt) <= pendingEventLifetime
    }

    let retainedIds = Set(retainedEvents.map(\.id))
    events = retainedEvents
    inFlightEventIds.formIntersection(retainedIds)

    if events.count > maxPendingEvents {
      let removalCount = events.count - maxPendingEvents
      let removedIds = Set(events.prefix(removalCount).map(\.id))
      events.removeFirst(removalCount)
      inFlightEventIds.subtract(removedIds)
    }
  }

  private func makeSnapshot() -> WatchPendingQueueSnapshot {
    WatchPendingQueueSnapshot(
      count: events.count,
      summaries: events.map(\.summary)
    )
  }

  private func persist() {
    let encodedEvents = events.compactMap { event -> String? in
      guard let data = try? JSONEncoder().encode(event) else {
        return nil
      }
      return String(data: data, encoding: .utf8)
    }

    defaults.set(encodedEvents, forKey: storageKey)
  }

  // 单次升级本地队列；网络入口只接受 v4，不提供旧协议回退。
  private static func migrateStoredEvents(defaults: UserDefaults, storageKey: String) {
    let marker = storageKey + "-v4-migrated"
    guard !defaults.bool(forKey: marker) else { return }
    let formatter = ISO8601DateFormatter()
    let precise = ISO8601DateFormatter()
    precise.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let converted = (defaults.stringArray(forKey: storageKey) ?? []).map { text -> String in
      guard let data = text.data(using: .utf8),
        var envelope = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        var event = envelope["event"] as? [String: Any], event["schemaVersion"] as? Int == 3
      else { return text }
      if event["type"] as? String == "training_completed" {
        guard let payload = event["payload"] as? [String: Any],
          let mode = payload["mode"] as? String,
          let config = WatchTodayState.TrainingModeConfig.fallbackModes.first(where: {
            $0.id == mode
          }),
          let duration = payload["durationSeconds"] as? Int,
          let createdAt = event["createdAt"] as? String,
          let ended = formatter.date(from: createdAt) ?? precise.date(from: createdAt),
          let originalId = event["id"] as? String
        else { return text }
        let exact = duration == (config.holdSeconds + config.restSeconds) * config.rounds
        let count =
          exact ? config.rounds : min(payload["completedSets"] as? Int ?? 0, config.rounds)
        let record = WatchTrainingRecord(
          id: "watch-" + originalId, presetId: mode,
          plan: .init(
            contractSeconds: config.holdSeconds, relaxSeconds: config.restSeconds,
            repetitions: config.rounds),
          // 仅保留旧协议原有的估算口径；新记录直接提供真实开始时间。
          startedAt: precise.string(from: ended.addingTimeInterval(-TimeInterval(duration))),
          endedAt: precise.string(from: ended),
          durationSeconds: duration, completedRepetitions: count, isCompleted: exact,
          feedback: "unanswered", endReason: exact ? "completed" : "interrupted")
        guard let recordData = try? JSONEncoder().encode(record),
          let recordJSON = try? JSONSerialization.jsonObject(with: recordData)
        else { return text }
        event["id"] = record.id
        event["type"] = "training_finished"
        event["payload"] = ["session": recordJSON]
      }
      event["schemaVersion"] = 4
      envelope["event"] = event
      envelope["schemaVersion"] = 4
      guard let data = try? JSONSerialization.data(withJSONObject: envelope) else { return text }
      return String(decoding: data, as: UTF8.self)
    }
    defaults.set(converted, forKey: storageKey)
    defaults.set(true, forKey: marker)
  }

  private static func loadEvents(defaults: UserDefaults, storageKey: String) -> [WatchOutboundEvent]
  {
    guard let encodedEvents = defaults.stringArray(forKey: storageKey) else {
      return []
    }

    return encodedEvents.compactMap { encodedEvent in
      guard let data = encodedEvent.data(using: .utf8) else {
        return nil
      }
      return try? JSONDecoder().decode(WatchOutboundEvent.self, from: data)
    }
  }
}

enum WatchDeliveryDisposition: Equatable, Sendable {
  case accepted, duplicate, rejected, retry

  static func classify(_ reply: [String: Any], eventId: String) -> WatchDeliveryDisposition {
    guard reply["eventId"] as? String == eventId else { return .retry }
    switch reply["status"] as? String {
    case "accepted": return .accepted
    case "duplicate": return .duplicate
    case "rejected": return .rejected
    default: return .retry
    }
  }
}
