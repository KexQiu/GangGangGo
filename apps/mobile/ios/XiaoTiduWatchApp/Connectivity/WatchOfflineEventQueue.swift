import Foundation

struct WatchOutboundEvent: Codable, Equatable, Sendable {
  struct Event: Codable, Equatable, Sendable {
    var createdAt: String
    var id: String
    var payload: Payload
    var schemaVersion: Int
    var type: String
  }

  struct Payload: Codable, Equatable, Sendable {
    var action: String?
    var completedSets: Int?
    var durationSeconds: Int?
    var elapsedSeconds: Int?
    var habitKey: String?
    var level: String?
    var mode: String?

    init(
      action: String? = nil,
      completedSets: Int? = nil,
      durationSeconds: Int? = nil,
      elapsedSeconds: Int? = nil,
      habitKey: String? = nil,
      level: String? = nil,
      mode: String? = nil
    ) {
      self.action = action
      self.completedSets = completedSets
      self.durationSeconds = durationSeconds
      self.elapsedSeconds = elapsedSeconds
      self.habitKey = habitKey
      self.level = level
      self.mode = mode
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
          let object = try? JSONSerialization.jsonObject(with: data) else {
      return nil
    }

    return object as? [String: Any]
  }

  var summary: String {
    switch event.type {
    case "training_completed":
      return "菊花抬完成待同步"
    case "habit_toggled":
      return "\(habitTitle(for: event.payload.habitKey))待同步"
    case "toilet_timer_action":
      return "\(toiletActionTitle(for: event.payload.action))待同步"
    default:
      return "待同步事件"
    }
  }

  static func trainingCompleted(mode: String, completedSets: Int, durationSeconds: Int) -> WatchOutboundEvent {
    make(
      type: "training_completed",
      payload: Payload(
        completedSets: completedSets,
        durationSeconds: durationSeconds,
        mode: mode
      )
    )
  }

  static func habitToggled(habitKey: String, level: String?) -> WatchOutboundEvent {
    make(type: "habit_toggled", payload: Payload(habitKey: habitKey, level: level))
  }

  static func toiletTimerAction(action: String, elapsedSeconds: Int) -> WatchOutboundEvent {
    make(
      type: "toilet_timer_action",
      payload: Payload(action: action, elapsedSeconds: elapsedSeconds)
    )
  }

  private static func make(type: String, payload: Payload) -> WatchOutboundEvent {
    WatchOutboundEvent(
      event: Event(
        createdAt: ISO8601DateFormatter().string(from: Date()),
        id: UUID().uuidString,
        payload: payload,
        schemaVersion: 2,
        type: type
      ),
      schemaVersion: 2,
      type: "watch_event"
    )
  }

  private func habitTitle(for key: String?) -> String {
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
  var removedUnauthorizedCount: Int
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

  func beginReplay(allowDelivery: Bool, now: Date = Date()) -> WatchPendingReplayBatch {
    purgeExpiredEvents(now: now)

    if !allowDelivery {
      let removedCount = events.count
      events.removeAll()
      inFlightEventIds.removeAll()
      persist()
      return WatchPendingReplayBatch(
        events: [],
        removedUnauthorizedCount: removedCount,
        snapshot: makeSnapshot()
      )
    }

    let readyEvents = events.filter { !inFlightEventIds.contains($0.id) }
    inFlightEventIds.formUnion(readyEvents.map(\.id))
    persist()

    return WatchPendingReplayBatch(
      events: readyEvents,
      removedUnauthorizedCount: 0,
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

  func pruneForAuthorization(allowDelivery: Bool, now: Date = Date()) -> (WatchPendingQueueSnapshot, Int) {
    purgeExpiredEvents(now: now)

    guard !allowDelivery else {
      persist()
      return (makeSnapshot(), 0)
    }

    let removedCount = events.count
    events.removeAll()
    inFlightEventIds.removeAll()
    persist()
    return (makeSnapshot(), removedCount)
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

  private static func loadEvents(defaults: UserDefaults, storageKey: String) -> [WatchOutboundEvent] {
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
