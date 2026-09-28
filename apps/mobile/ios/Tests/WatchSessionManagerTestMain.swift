import Foundation

// 以可控传输替代 WCSession，编译并运行真实 WatchSessionManager。
// 不替代 watchOS scheme 构建或配对设备验收。
final class WatchConnectivityClient {
  var onActivationCompleted: ((Error?) -> Void)?
  var onPayloadReceived: (([String: Any]) -> Void)?
  var onReachabilityChanged: ((Bool) -> Void)?
  var isReadyToSend = false
  var isSupported = true
  var isReachable: Bool { isReadyToSend }
  var stateJSON = ""
  var sentEvents: [([String: Any], (Result<[String: Any], Error>) -> Void)] = []
  func activate() {}
  func sendMessage(
    _ message: [String: Any], completion: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    if message["type"] as? String == "request_today_state" {
      completion(.success(["stateJson": stateJSON]))
    } else {
      sentEvents.append((message, completion))
    }
  }
}

final class WatchStateStore {
  var state: WatchTodayState = .placeholder
  init(state: WatchTodayState = .placeholder) { self.state = state }
  func load() -> WatchTodayState { state }
  func save(_ state: WatchTodayState) { self.state = state }
}

@main
struct WatchSessionManagerTestMain {
  @MainActor
  static func main() async throws {
    let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
    let state = try JSONDecoder().decode(WatchTodayState.self, from: data)
    let suite = "com.kex.xiaotidu.manager-tests.\(UUID().uuidString)"
    let defaults = UserDefaults(suiteName: suite)!
    defer { defaults.removePersistentDomain(forName: suite) }
    let queue = WatchOfflineEventQueue(defaults: defaults)
    let client = WatchConnectivityClient()
    client.stateJSON = String(decoding: data, as: UTF8.self)
    let manager = WatchSessionManager(
      connectivityClient: client, eventQueue: queue, stateStore: WatchStateStore(state: state))
    client.isReadyToSend = true
    let id = manager.sendTrainingCompleted(
      owner: state.account.owner!, mode: "standard", completedSets: 1, durationSeconds: 120)!
    try await waitFor { client.sentEvents.count == 1 }
    try expect(await queue.snapshot().count == 1, "live delivery must persist before sending")
    let firstReply = client.sentEvents[0].1
    firstReply(.success(["eventId": id, "status": "retryable", "stateJson": client.stateJSON]))
    try await waitFor { manager.lastError != nil }
    try expect(await queue.snapshot().count == 1, "retryable ACK must retain event")
    try expect(client.sentEvents.count == 1, "ACK state refresh must not bypass retry backoff")
    try expect(manager.trainingDelivery?.disposition == .retry, "training must not claim saved")

    manager.setApplicationActive(true)
    try await waitFor { client.sentEvents.count == 2 }
    firstReply(.success(["eventId": id, "status": "accepted"]))
    // 旧尝试的迟到回执不能移除仍由新尝试处理的事件。
    try await Task.sleep(for: .milliseconds(20))
    try expect(await queue.snapshot().count == 1, "late ACK must not resolve a new attempt")
    client.sentEvents[1].1(.success(["eventId": "wrong", "status": "accepted"]))
    try await waitFor { manager.lastError != nil }
    try expect(await queue.snapshot().count == 1, "wrong event ID must not acknowledge")

    manager.setApplicationActive(true)
    try await waitFor { client.sentEvents.count == 3 }
    client.sentEvents[2].1(.success(["eventId": id, "status": "duplicate"]))
    try await waitFor { manager.pendingEventCount == 0 }
    try expect(await queue.snapshot().count == 0, "confirmed duplicate must leave queue")
    try expect(
      manager.trainingDelivery?.disposition == .duplicate, "training must show confirmed save")

    let rejectedId = manager.sendTrainingCompleted(
      owner: state.account.owner!, mode: "standard", completedSets: 1, durationSeconds: 120)!
    try await waitFor { client.sentEvents.count == 4 }
    client.sentEvents[3].1(
      .success(["eventId": rejectedId, "status": "rejected", "message": "account changed"]))
    try await waitFor { manager.trainingDelivery?.disposition == .rejected }
    try expect(await queue.snapshot().count == 0, "permanent refusal must stop retrying")
    try expect(manager.lastError == "account changed", "permanent refusal must be visible")

    let unansweredId = manager.sendTrainingCompleted(
      owner: state.account.owner!, mode: "standard", completedSets: 1, durationSeconds: 120)!
    try await waitFor { client.sentEvents.count == 5 }
    try await waitFor(attempts: 2_000) { manager.lastError?.contains("超时") == true }
    try expect(
      await queue.snapshot().count == 1, "missing callback must time out without losing the event")
    manager.setApplicationActive(true)
    try await waitFor { client.sentEvents.count == 6 }
    client.sentEvents[5].1(.success(["eventId": unansweredId, "status": "accepted"]))
    try await waitFor { manager.trainingDelivery?.disposition == .accepted }
    try expect(await queue.snapshot().count == 0, "timeout retry must remain acknowledgeable")
    manager.setApplicationActive(false)

    var newer = state
    newer.revision += 1
    newer.account.owner = WatchEventOwner(userId: "B", profileId: "profile-B")
    let newerJSON = String(decoding: try JSONEncoder().encode(newer), as: UTF8.self)
    client.onPayloadReceived?(["stateJson": newerJSON])
    try await waitFor { manager.todayState.account.owner == newer.account.owner }
    let changedOwnerResult = manager.sendTrainingCompleted(
      owner: state.account.owner!, mode: "standard", completedSets: 1, durationSeconds: 120)
    try expect(changedOwnerResult == nil, "training must keep its start owner after an account switch")
    try expect(await queue.snapshot().count == 0, "old training must not enter the new owner's queue")
    client.onPayloadReceived?(["stateJson": String(decoding: data, as: UTF8.self)])
    try await Task.sleep(for: .milliseconds(20))
    try expect(manager.todayState == newer, "late snapshots must not restore the old account")

    let persisted = WatchStateStore(state: newer)
    let restoredClient = WatchConnectivityClient()
    let restored = WatchSessionManager(connectivityClient: restoredClient, stateStore: persisted)
    restored.setApplicationActive(false)
    restoredClient.onPayloadReceived?(["stateJson": String(decoding: data, as: UTF8.self)])
    try await Task.sleep(for: .milliseconds(20))
    try expect(restored.todayState == newer, "snapshot ordering must survive restart")
    print("Watch session manager tests passed (mock transport)")
  }

  @MainActor
  private static func waitFor(attempts: Int = 100, _ condition: () -> Bool) async throws {
    for _ in 0..<attempts {
      if condition() { return }
      try await Task.sleep(for: .milliseconds(10))
    }
    throw Failure(message: "timed out waiting for manager")
  }
  private static func expect(_ condition: Bool, _ message: String) throws {
    if !condition { throw Failure(message: message) }
  }
  private struct Failure: Error { let message: String }
}
