import Foundation

@main
struct WatchCoreTestMain {
  static func main() async throws {
    try await testOfflineQueueLifecycle()
    try await testOfflineQueueLimitsAndAuthorization()
    try testTrainingTimeline()
    try testToiletHapticTimeline()
    try testRefreshBackoff()
    try testLegacyStateCompatibility()
    print("Watch core tests passed")
  }

  private static func testOfflineQueueLifecycle() async throws {
    let (defaults, suiteName) = makeDefaults()
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let event = WatchOutboundEvent.trainingCompleted(mode: "standard", completedSets: 1, durationSeconds: 120)
    let queue = WatchOfflineEventQueue(defaults: defaults)

    _ = await queue.enqueue(event)
    let duplicateSnapshot = await queue.enqueue(event)
    try expect(duplicateSnapshot.count == 1, "duplicate event must not be queued twice")

    let restoredQueue = WatchOfflineEventQueue(defaults: defaults)
    try expect(await restoredQueue.snapshot().count == 1, "pending event must survive queue restart")

    let firstReplay = await restoredQueue.beginReplay(allowDelivery: true)
    try expect(firstReplay.events.map(\.id) == [event.id], "pending event must be replayed once")
    let duplicateReplay = await restoredQueue.beginReplay(allowDelivery: true)
    try expect(duplicateReplay.events.isEmpty, "in-flight event must not replay concurrently")

    _ = await restoredQueue.deliveryFailed(eventId: event.id)
    let retryReplay = await restoredQueue.beginReplay(allowDelivery: true)
    try expect(retryReplay.events.map(\.id) == [event.id], "failed delivery must become replayable")

    let acknowledged = await restoredQueue.acknowledge(eventId: event.id)
    try expect(acknowledged.count == 0, "ACK must remove the pending event")
    try expect(await WatchOfflineEventQueue(defaults: defaults).snapshot().count == 0, "ACK removal must persist")
  }

  private static func testOfflineQueueLimitsAndAuthorization() async throws {
    let (defaults, suiteName) = makeDefaults()
    defer { defaults.removePersistentDomain(forName: suiteName) }
    let queue = WatchOfflineEventQueue(defaults: defaults)

    for index in 0..<30 {
      _ = await queue.enqueue(
        .toiletTimerAction(action: index.isMultiple(of: 2) ? "pause" : "resume", elapsedSeconds: index)
      )
    }
    try expect(await queue.snapshot().count == 25, "queue must retain only the newest 25 events")

    let unauthorizedBatch = await queue.beginReplay(allowDelivery: false)
    try expect(unauthorizedBatch.events.isEmpty, "unauthorized events must not be replayed")
    try expect(unauthorizedBatch.removedUnauthorizedCount == 25, "authorization pruning must report removed events")
    try expect(unauthorizedBatch.snapshot.count == 0, "authorization pruning must clear the queue")

    var expiredEvent = WatchOutboundEvent.habitToggled(habitKey: "water", level: "done")
    expiredEvent.event.createdAt = ISO8601DateFormatter().string(from: Date(timeIntervalSinceNow: -(25 * 60 * 60)))
    _ = await queue.enqueue(expiredEvent)
    try expect(await queue.snapshot().count == 0, "events older than 24 hours must expire")
  }

  private static func testTrainingTimeline() throws {
    let mode = WatchTrainingMode(config: .init(id: "test", holdSeconds: 5, restSeconds: 3, rounds: 2))
    let start = Date(timeIntervalSince1970: 1_000)
    var session = WatchTrainingSession(mode: mode, startedAt: start)

    let initial = session.snapshot(at: start)
    try expect(initial.phase == .hold && initial.remainingSeconds == 5, "training must begin in hold phase")

    let firstBoundary = try require(session.nextBoundary(after: start), "first training boundary is missing")
    try expect(firstBoundary.phase == .rest, "first boundary must enter rest phase")
    try expect(abs(firstBoundary.date.timeIntervalSince(start) - 5) < 0.001, "first boundary must occur after hold duration")

    let restSnapshot = session.snapshot(at: start.addingTimeInterval(5))
    try expect(restSnapshot.phase == .rest && restSnapshot.remainingSeconds == 3, "rest remaining time is incorrect")

    session.togglePause(at: start.addingTimeInterval(6))
    try expect(session.nextBoundary(after: start.addingTimeInterval(10)) == nil, "paused training must not schedule a boundary")
    session.togglePause(at: start.addingTimeInterval(10))
    let resumedBoundary = try require(session.nextBoundary(after: start.addingTimeInterval(10)), "resumed boundary is missing")
    try expect(abs(resumedBoundary.date.timeIntervalSince(start) - 12) < 0.001, "pause duration must shift the next boundary")

    let finishDate = start.addingTimeInterval(TimeInterval(mode.totalDurationSeconds + 4))
    let finished = session.snapshot(at: finishDate)
    try expect(finished.isFinished && finished.remainingSeconds == 0, "training finish derivation is incorrect")

    var boundaryKeys: [String] = []
    var boundaryDate = start
    let uninterruptedSession = WatchTrainingSession(mode: mode, startedAt: start)
    while let boundary = uninterruptedSession.nextBoundary(after: boundaryDate) {
      boundaryKeys.append(boundary.key)
      boundaryDate = boundary.date.addingTimeInterval(0.001)
    }
    try expect(boundaryKeys.count == 4, "two training rounds must have four one-shot boundaries")
    try expect(Set(boundaryKeys).count == boundaryKeys.count, "training boundary keys must be unique")
  }

  private static func testToiletHapticTimeline() throws {
    try expect(
      WatchToiletHapticTimeline.nextBoundary(after: 0) == .init(elapsedSeconds: 300, stage: .gentleWarning),
      "first toilet haptic boundary is incorrect"
    )
    try expect(
      WatchToiletHapticTimeline.nextBoundary(after: 300) == .init(elapsedSeconds: 600, stage: .strongWarning),
      "toilet haptic must advance after an exact boundary"
    )
    try expect(WatchToiletHapticTimeline.nextBoundary(after: 1_200) == nil, "no haptic should be scheduled after final boundary")
    try expect(
      Set(WatchToiletHapticTimeline.boundaries.map(\.stage.rawValue)).count == WatchToiletHapticTimeline.boundaries.count,
      "toilet haptic stages must have unique one-shot boundaries"
    )
  }

  private static func testRefreshBackoff() throws {
    var backoff = WatchRefreshBackoff()
    let delays = (0..<6).compactMap { _ in backoff.takeNextDelay(isApplicationActive: true) }
    try expect(delays == [5, 10, 20, 30, 30, 30], "refresh retry must back off from 5 to 30 seconds")
    try expect(backoff.takeNextDelay(isApplicationActive: false) == nil, "background state must not schedule a retry")
    backoff.reset()
    try expect(backoff.takeNextDelay(isApplicationActive: true) == 5, "foreground reset must restore the 5 second delay")
  }

  private static func testLegacyStateCompatibility() throws {
    let legacyState: [String: Any] = [
      "account": ["isLoggedIn": true],
      "date": "2026-07-13",
      "generatedAt": "2026-07-13T10:00:00Z",
      "habits": [
        "bowelDone": false,
        "completion": 1,
        "fiberDone": false,
        "movementDone": false,
        "waterDone": true,
      ],
      "proStatus": "pro_active",
      "toilet": ["isRunning": false],
      "training": ["completedSets": 0, "done": false],
    ]
    let data = try JSONSerialization.data(withJSONObject: legacyState)
    let decoded = try JSONDecoder().decode(WatchTodayState.self, from: data)

    try expect(decoded.schemaVersion == 1, "legacy Watch state must default to schema version 1")
    try expect(
      decoded.trainingModes == WatchTodayState.TrainingModeConfig.fallbackModes,
      "legacy Watch state must receive fallback training modes"
    )
    try expect(decoded.toilet.elapsedSeconds == 0, "legacy toilet state must receive safe defaults")
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
