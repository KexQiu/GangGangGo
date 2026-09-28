import Foundation

@main
struct WatchCoreTestMain {
  static func main() async throws {
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

  private static func testOfflineQueueLifecycle() async throws {
    let (defaults, suiteName) = makeDefaults()
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let event = WatchOutboundEvent.trainingCompleted(
      owner: owner, mode: "standard", completedSets: 1, durationSeconds: 120)
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
    try expect(changedAccountBatch.events.count == 1, "replay must deliver in order one at a time")
    try expect(
      changedAccountBatch.events.first?.event.owner == owner,
      "replay must never retarget the original owner")
    let rejected = await queue.resolve(
      eventId: changedAccountBatch.events[0].id, disposition: .rejected)
    try expect(rejected.count == 24, "only explicit rejection should remove an unauthorized event")

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
    let mode = WatchTrainingMode(
      config: .init(id: "test", holdSeconds: 5, restSeconds: 3, rounds: 2))
    let start = Date(timeIntervalSince1970: 1_000)
    var session = WatchTrainingSession(owner: owner, mode: mode, startedAt: start)

    let initial = session.snapshot(at: start)
    try expect(
      initial.phase == .hold && initial.remainingSeconds == 5, "training must begin in hold phase")

    let firstBoundary = try require(
      session.nextBoundary(after: start), "first training boundary is missing")
    try expect(firstBoundary.phase == .rest, "first boundary must enter rest phase")
    try expect(
      abs(firstBoundary.date.timeIntervalSince(start) - 5) < 0.001,
      "first boundary must occur after hold duration")

    let restSnapshot = session.snapshot(at: start.addingTimeInterval(5))
    try expect(
      restSnapshot.phase == .rest && restSnapshot.remainingSeconds == 3,
      "rest remaining time is incorrect")

    session.togglePause(at: start.addingTimeInterval(6))
    try expect(
      session.nextBoundary(after: start.addingTimeInterval(10)) == nil,
      "paused training must not schedule a boundary")
    session.togglePause(at: start.addingTimeInterval(10))
    let resumedBoundary = try require(
      session.nextBoundary(after: start.addingTimeInterval(10)), "resumed boundary is missing")
    try expect(
      abs(resumedBoundary.date.timeIntervalSince(start) - 12) < 0.001,
      "pause duration must shift the next boundary")

    let finishDate = start.addingTimeInterval(TimeInterval(mode.totalDurationSeconds + 4))
    let finished = session.snapshot(at: finishDate)
    try expect(
      finished.isFinished && finished.remainingSeconds == 0,
      "training finish derivation is incorrect")

    var boundaryKeys: [String] = []
    var boundaryDate = start
    let uninterruptedSession = WatchTrainingSession(owner: owner, mode: mode, startedAt: start)
    while let boundary = uninterruptedSession.nextBoundary(after: boundaryDate) {
      boundaryKeys.append(boundary.key)
      boundaryDate = boundary.date.addingTimeInterval(0.001)
    }
    try expect(boundaryKeys.count == 4, "two training rounds must have four one-shot boundaries")
    try expect(
      Set(boundaryKeys).count == boundaryKeys.count, "training boundary keys must be unique")
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
