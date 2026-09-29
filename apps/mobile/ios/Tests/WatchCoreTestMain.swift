import Foundation

@main
struct WatchCoreTestMain {
  static func main() async throws {
    try await testLegacyQueueMigration()
    try await testOfflineQueueLifecycle()
    try await testOfflineQueueLimitsAndAuthorization()
    try await testBusinessAcknowledgements()
    try testTrainingTimeline()
    try testToiletHapticTimeline()
    try testRefreshBackoff()
    try testCurrentStateContract()
    print("Watch core tests passed")
  }

  private static let owner = WatchEventOwner(userId: "user-A", profileId: "profile-A")

  private static func testLegacyQueueMigration() async throws {
    let (defaults, suiteName) = makeDefaults()
    defer { defaults.removePersistentDomain(forName: suiteName) }
    let ended = ISO8601DateFormatter().string(from: Date())
    let old: [String: Any] = [
      "type": "watch_event", "schemaVersion": 3,
      "event": [
        "id": "legacy-training", "type": "training_completed", "schemaVersion": 3,
        "owner": ["userId": owner.userId, "profileId": owner.profileId], "createdAt": ended,
        "payload": ["mode": "standard", "durationSeconds": 120, "completedSets": 1],
      ],
    ]
    let data = try JSONSerialization.data(withJSONObject: old)
    defaults.set([String(decoding: data, as: UTF8.self)], forKey: "xiaotidu-watch-pending-events")
    let queue = WatchOfflineEventQueue(defaults: defaults)
    let batch = await queue.beginReplay(allowDelivery: true, owner: owner)
    try expect(batch.events.count == 1, "upgrade must preserve queued training")
    let event = batch.events[0]
    try expect(
      event.id == "watch-legacy-training" && event.event.schemaVersion == 4,
      "upgrade must keep the original database record identity")
    try expect(
      event.event.payload.session?.completedRepetitions == 12,
      "one old completed set must become twelve actual repetitions")
    try expect(
      event.event.payload.session?.feedback == "unanswered",
      "old unchecked discomfort was not an explicit answer")
    let restarted = WatchOfflineEventQueue(defaults: defaults)
    try expect(
      await restarted.snapshot().count == 1, "one-off migration must not duplicate a record")
    let record = event.event.payload.session!
    let first = WatchOutboundEvent.trainingFinished(owner: owner, session: record)
    let retry = WatchOutboundEvent.trainingFinished(owner: owner, session: record)
    try expect(
      first == retry && retry.event.createdAt == record.endedAt,
      "recreating an outbound event must preserve identical receipt content")
  }

  private static func testOfflineQueueLifecycle() async throws {
    let (defaults, suiteName) = makeDefaults()
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let event = WatchOutboundEvent.trainingFinished(owner: owner, session: makeRecord())
    let queue = WatchOfflineEventQueue(defaults: defaults)

    _ = await queue.enqueue(event)
    let duplicateSnapshot = await queue.enqueue(event)
    try expect(duplicateSnapshot.count == 1, "duplicate event must not be queued twice")

    let restoredQueue = WatchOfflineEventQueue(defaults: defaults)
    try expect(
      await restoredQueue.snapshot().count == 1, "pending event must survive queue restart")

    let firstReplay = await restoredQueue.beginReplay(allowDelivery: true, owner: owner)
    try expect(firstReplay.events.map(\.id) == [event.id], "pending event must be replayed once")
    let duplicateReplay = await restoredQueue.beginReplay(allowDelivery: true, owner: owner)
    try expect(duplicateReplay.events.isEmpty, "in-flight event must not replay concurrently")

    _ = await restoredQueue.deliveryFailed(eventId: event.id)
    let retryReplay = await restoredQueue.beginReplay(allowDelivery: true, owner: owner)
    try expect(retryReplay.events.map(\.id) == [event.id], "failed delivery must become replayable")

    let acknowledged = await restoredQueue.acknowledge(eventId: event.id)
    try expect(acknowledged.count == 0, "ACK must remove the pending event")
    try expect(
      await WatchOfflineEventQueue(defaults: defaults).snapshot().count == 0,
      "ACK removal must persist")
  }

  private static func testOfflineQueueLimitsAndAuthorization() async throws {
    let (defaults, suiteName) = makeDefaults()
    defer { defaults.removePersistentDomain(forName: suiteName) }
    let queue = WatchOfflineEventQueue(defaults: defaults)

    for index in 0..<30 {
      _ = await queue.enqueue(
        .toiletTimerAction(
          owner: owner, sessionId: "timer-A", action: index.isMultiple(of: 2) ? "pause" : "resume",
          elapsedSeconds: index)
      )
    }
    try expect(await queue.snapshot().count == 25, "queue must retain only the newest 25 events")

    let unauthorizedBatch = await queue.beginReplay(allowDelivery: false, owner: nil)
    try expect(unauthorizedBatch.events.isEmpty, "unauthorized events must not be replayed")
    try expect(
      unauthorizedBatch.snapshot.count == 25,
      "temporary unavailable authorization must preserve the queue")
    let newOwner = WatchEventOwner(userId: "user-B", profileId: "profile-B")
    let changedAccountBatch = await queue.beginReplay(allowDelivery: true, owner: newOwner)
    try expect(
      changedAccountBatch.events.isEmpty,
      "old owner events must stay queued instead of being sent under a different login")
    try expect(
      changedAccountBatch.snapshot.count == 25, "switching accounts must retain the original queue")
    let originalAccountBatch = await queue.beginReplay(allowDelivery: true, owner: owner)
    try expect(
      originalAccountBatch.events.count == 1, "restoring the original owner resumes serial delivery"
    )
    let rejected = await queue.resolve(
      eventId: originalAccountBatch.events[0].id, disposition: .rejected)
    try expect(rejected.count == 24, "explicit rejection only removes the targeted event")

    var expiredEvent = WatchOutboundEvent.habitToggled(
      owner: owner, habitKey: "water", level: "good")
    expiredEvent.event.createdAt = ISO8601DateFormatter().string(
      from: Date(timeIntervalSinceNow: -(25 * 60 * 60)))
    _ = await queue.enqueue(expiredEvent)
    try expect(
      await queue.snapshot().count == 24,
      "events older than 24 hours must expire without deleting other events")
  }

  private static func testBusinessAcknowledgements() async throws {
    let (defaults, suiteName) = makeDefaults()
    defer { defaults.removePersistentDomain(forName: suiteName) }
    let queue = WatchOfflineEventQueue(defaults: defaults)
    let event = WatchOutboundEvent.habitToggled(owner: owner, habitKey: "water", level: nil)
    let payload = event.messageDictionary?["event"] as? [String: Any]
    let fields = payload?["payload"] as? [String: Any]
    try expect(
      fields?["level"] == nil,
      "clearing a habit must omit its level for the WatchConnectivity property list")
    _ = await queue.enqueue(event)
    for reply: [String: Any] in [
      ["eventId": event.id, "status": "retryable"],
      ["eventId": "wrong-id", "status": "accepted"],
      ["eventId": event.id, "status": "unknown"], [:],
    ] {
      _ = await queue.beginReplay(allowDelivery: true, owner: owner)
      let disposition = WatchDeliveryDisposition.classify(reply, eventId: event.id)
      try expect(disposition == .retry, "transport success alone must not acknowledge a record")
      let snapshot = await queue.resolve(eventId: event.id, disposition: disposition)
      try expect(snapshot.count == 1, "unconfirmed event must remain persisted")
    }
    let restarted = WatchOfflineEventQueue(defaults: defaults)
    let replay = await restarted.beginReplay(allowDelivery: true, owner: owner)
    try expect(
      replay.events.map(\.id) == [event.id], "unconfirmed event must survive process restart")
    for status in ["accepted", "duplicate", "rejected"] {
      _ = await restarted.enqueue(event)
      let disposition = WatchDeliveryDisposition.classify(
        ["eventId": event.id, "status": status], eventId: event.id)
      let snapshot = await restarted.resolve(eventId: event.id, disposition: disposition)
      try expect(snapshot.count == 0, "terminal business ACK must remove the event")
    }
  }

  private static func testTrainingTimeline() throws {
    var slowPrompt = WatchTrainingSession(
      owner: owner,
      mode: WatchTrainingMode(
        config: .init(id: "quick", holdSeconds: 1, restSeconds: 1, rounds: 16)), uptime: 0)
    slowPrompt.sample(uptime: 3)
    slowPrompt.confirmPrompt(uptime: 3.8)
    try expect(
      slowPrompt.nextBoundary(uptime: 3.8)?.delay == 1,
      "a slow checkpoint write must not shorten the issued contraction")
    slowPrompt.sample(uptime: 4.8)
    slowPrompt.confirmPrompt(uptime: 5.6)
    try expect(
      slowPrompt.nextBoundary(uptime: 5.6)?.delay == 1,
      "relaxation must run in full from the issued prompt")

    let start = Date(timeIntervalSince1970: 1_800_000_000)
    for config in WatchTodayState.TrainingModeConfig.fallbackModes {
      let mode = WatchTrainingMode(config: config)
      var current = WatchTrainingSession(owner: owner, mode: mode, startedAt: start, uptime: 0)
      var uptime: TimeInterval = 0
      try expect(
        current.snapshot(uptime: 0).phase == .prepare, "training must prepare before contraction")
      while let boundary = current.nextBoundary(
        after: start.addingTimeInterval(uptime), uptime: uptime)
      {
        uptime += boundary.delay
        current.sample(at: start.addingTimeInterval(uptime), uptime: uptime)
      }
      try expect(
        current.record?.completedRepetitions == mode.rounds,
        "all modes must retain their actual repetitions")
      try expect(
        current.record?.durationSeconds == mode.totalDurationSeconds,
        "preparation must not count as activity")
    }
    let quick = WatchTrainingMode(
      config: .init(id: "quick", holdSeconds: 1, restSeconds: 1, rounds: 16))
    var delayed = WatchTrainingSession(owner: owner, mode: quick, startedAt: start, uptime: 0)
    delayed.sample(at: start.addingTimeInterval(3), uptime: 3)
    delayed.sample(at: start.addingTimeInterval(5.1), uptime: 5.1)
    try expect(
      delayed.isPaused && delayed.interrupted && delayed.completedRepetitions == 0,
      "late tick must pause without skipping relaxation or credit")
    delayed.resume(at: start.addingTimeInterval(10), uptime: 10)
    delayed.sample(at: start.addingTimeInterval(11), uptime: 11)
    try expect(
      delayed.phase == .hold && delayed.completedRepetitions == 0,
      "incomplete contraction needs restart after relaxation")
    delayed.sample(at: start.addingTimeInterval(12), uptime: 12)
    delayed.pause(at: start.addingTimeInterval(12.5), uptime: 12.5)
    delayed.resume(at: start.addingTimeInterval(20), uptime: 20)
    try expect(
      delayed.nextBoundary(after: start, uptime: 20)?.delay == 1, "resumed rest must run in full")
    delayed.sample(at: start.addingTimeInterval(21), uptime: 21)
    try expect(
      delayed.completedRepetitions == 1, "previous full contraction must count only after full rest"
    )
    delayed.pause(at: start.addingTimeInterval(21), uptime: 21)
    let elapsed = delayed.snapshot(uptime: 21).elapsedSeconds
    try expect(
      delayed.snapshot(uptime: 300).elapsedSeconds == elapsed
        && delayed.nextBoundary(uptime: 300) == nil, "inactive time must not count or complete")
    delayed.finish(reason: "user_stopped", at: start.addingTimeInterval(300), uptime: 300)
    let record = delayed.record
    delayed.finish(reason: "discomfort", at: start.addingTimeInterval(301), uptime: 301)
    try expect(
      delayed.record == record && record?.isCompleted == false,
      "finish must freeze its ID, timestamps and repetitions")
    try expect(
      record?.startedAt == ISO8601DateFormatter().string(from: start),
      "pause must not shift the recorded start time")
  }

  private static func testToiletHapticTimeline() throws {
    try expect(
      WatchToiletHapticTimeline.nextBoundary(after: 0)
        == .init(elapsedSeconds: 300, stage: .gentleWarning),
      "first toilet haptic boundary is incorrect"
    )
    try expect(
      WatchToiletHapticTimeline.nextBoundary(after: 300)
        == .init(elapsedSeconds: 600, stage: .strongWarning),
      "toilet haptic must advance after an exact boundary"
    )
    try expect(
      WatchToiletHapticTimeline.nextBoundary(after: 1_200) == nil,
      "no haptic should be scheduled after final boundary")
    try expect(
      Set(WatchToiletHapticTimeline.boundaries.map(\.stage.rawValue)).count
        == WatchToiletHapticTimeline.boundaries.count,
      "toilet haptic stages must have unique one-shot boundaries"
    )
  }

  private static func testRefreshBackoff() throws {
    var backoff = WatchRefreshBackoff()
    let delays = (0..<6).compactMap { _ in backoff.takeNextDelay(isApplicationActive: true) }
    try expect(
      delays == [5, 10, 20, 30, 30, 30], "refresh retry must back off from 5 to 30 seconds")
    try expect(
      backoff.takeNextDelay(isApplicationActive: false) == nil,
      "background state must not schedule a retry")
    backoff.reset()
    try expect(
      backoff.takeNextDelay(isApplicationActive: true) == 5,
      "foreground reset must restore the 5 second delay")
  }

  private static func testCurrentStateContract() throws {
    let data = try JSONEncoder().encode(WatchTodayState.placeholder)
    let decoded = try JSONDecoder().decode(WatchTodayState.self, from: data)
    try expect(decoded == WatchTodayState.placeholder, "current state must round-trip")

    let state = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    for key in ["schemaVersion", "canUseActions", "revision"] {
      var incomplete = state
      incomplete.removeValue(forKey: key)
      let invalid = try JSONSerialization.data(withJSONObject: incomplete)
      try expect(
        (try? JSONDecoder().decode(WatchTodayState.self, from: invalid)) == nil,
        "missing required state fields must be rejected")
    }
    var unsupported = state
    unsupported["schemaVersion"] = 1
    let invalid = try JSONSerialization.data(withJSONObject: unsupported)
    try expect(
      (try? JSONDecoder().decode(WatchTodayState.self, from: invalid)) == nil,
      "unsupported state versions must be rejected")
  }

  private static func makeRecord() -> WatchTrainingRecord {
    let end = Date()
    let formatter = ISO8601DateFormatter()
    return WatchTrainingRecord(
      id: "watch-" + UUID().uuidString, presetId: "standard",
      plan: .init(contractSeconds: 5, relaxSeconds: 5, repetitions: 12),
      startedAt: formatter.string(from: end.addingTimeInterval(-120)),
      endedAt: formatter.string(from: end),
      durationSeconds: 120, completedRepetitions: 12, isCompleted: true, feedback: "unanswered",
      endReason: "completed")
  }

  private static func makeDefaults() -> (UserDefaults, String) {
    let suiteName = "com.kex.xiaotidu.watch-tests.\(UUID().uuidString)"
    let defaults = UserDefaults(suiteName: suiteName)!
    defaults.removePersistentDomain(forName: suiteName)
    return (defaults, suiteName)
  }

  private static func expect(_ condition: Bool, _ message: String) throws {
    guard condition else {
      throw TestFailure(message)
    }
  }

  private static func require<T>(_ value: T?, _ message: String) throws -> T {
    guard let value else {
      throw TestFailure(message)
    }
    return value
  }
}

private struct TestFailure: LocalizedError {
  let errorDescription: String?

  init(_ message: String) {
    errorDescription = message
  }
}
