import ActivityKit
import ExpoModulesCore
import Foundation

public final class GangGangGoLiveActivityModule: Module {
  private let client = LiveActivityClient()

  public func definition() -> ModuleDefinition {
    Name("GangGangGoLiveActivity")

    AsyncFunction("isSupported") { () -> Bool in
      self.client.isSupported()
    }
    AsyncFunction("start") {
      (startedAtISO: String, elapsedSeconds: Double, snapshot: [String: Any], promise: Promise) in
      self.client.start(startedAtISO, elapsedSeconds: elapsedSeconds, snapshot: snapshot, promise: promise)
    }
    AsyncFunction("pause") {
      (activityId: String, elapsedSeconds: Double, snapshot: [String: Any], promise: Promise) in
      self.client.update(
        activityId: activityId,
        elapsedSeconds: elapsedSeconds,
        isPaused: true,
        snapshot: snapshot,
        promise: promise
      )
    }
    AsyncFunction("resume") {
      (activityId: String, elapsedSeconds: Double, snapshot: [String: Any], promise: Promise) in
      self.client.update(
        activityId: activityId,
        elapsedSeconds: elapsedSeconds,
        isPaused: false,
        snapshot: snapshot,
        promise: promise
      )
    }
    AsyncFunction("sync") {
      (activityId: String, elapsedSeconds: Double, isPaused: Bool, snapshot: [String: Any], promise: Promise) in
      self.client.update(
        activityId: activityId,
        elapsedSeconds: elapsedSeconds,
        isPaused: isPaused,
        snapshot: snapshot,
        promise: promise
      )
    }
    AsyncFunction("end") {
      (activityId: String, elapsedSeconds: Double, snapshot: [String: Any], promise: Promise) in
      self.client.end(activityId, elapsedSeconds: elapsedSeconds, snapshot: snapshot, promise: promise)
    }
    AsyncFunction("endAll") { (promise: Promise) in
      self.client.endAll(promise: promise)
    }
    AsyncFunction("reconcile") {
      (
        activityId: String?,
        startedAtISO: String,
        elapsedSeconds: Double,
        isPaused: Bool,
        snapshot: [String: Any],
        promise: Promise
      ) in
      self.client.reconcile(
        activityId: activityId,
        startedAtISO: startedAtISO,
        elapsedSeconds: elapsedSeconds,
        isPaused: isPaused,
        snapshot: snapshot,
        promise: promise
      )
    }
  }
}

private final class LiveActivityClient {
  func isSupported() -> Bool {
    guard #available(iOS 16.1, *) else {
      return false
    }
    return ActivityAuthorizationInfo().areActivitiesEnabled
  }

  func start(_ startedAtISO: String, elapsedSeconds: Double, snapshot: [String: Any], promise: Promise) {
    guard #available(iOS 16.1, *) else {
      promise.resolve(nil)
      return
    }

    Task {
      do {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
          promise.reject("toilet_live_activity_disabled", "Live Activity is disabled for this app or device.")
          return
        }

        await endExistingActivities()
        let elapsed = max(0, elapsedSeconds)
        let state = makeContentState(
          startedAtISO: startedAtISO,
          elapsedSeconds: elapsed,
          isPaused: false,
          snapshot: snapshot
        )
        let activity = try Activity<ToiletTimerAttributes>.request(
          attributes: ToiletTimerAttributes(title: "蹲会儿"),
          contentState: state,
          pushType: nil
        )
        promise.resolve(activity.id)
      } catch {
        promise.reject("toilet_live_activity_start_failed", error.localizedDescription)
      }
    }
  }

  func update(
    activityId: String,
    elapsedSeconds: Double,
    isPaused: Bool,
    snapshot: [String: Any],
    promise: Promise
  ) {
    guard #available(iOS 16.1, *) else {
      promise.resolve(nil)
      return
    }

    Task {
      guard let activity = activity(with: activityId) else {
        promise.resolve(nil)
        return
      }
      let state = makeContentState(
        elapsedSeconds: max(0, elapsedSeconds),
        isPaused: isPaused,
        snapshot: snapshot
      )
      await activity.update(using: state)
      promise.resolve(nil)
    }
  }

  func end(_ activityId: String, elapsedSeconds: Double, snapshot: [String: Any], promise: Promise) {
    guard #available(iOS 16.1, *) else {
      promise.resolve(nil)
      return
    }

    Task {
      guard let activity = activity(with: activityId) else {
        promise.resolve(nil)
        return
      }
      let state = makeContentState(
        elapsedSeconds: max(0, elapsedSeconds),
        isPaused: true,
        snapshot: snapshot
      )
      await activity.end(using: state, dismissalPolicy: .immediate)
      promise.resolve(nil)
    }
  }

  func endAll(promise: Promise) {
    guard #available(iOS 16.1, *) else {
      promise.resolve(nil)
      return
    }

    Task {
      await endExistingActivities()
      promise.resolve(nil)
    }
  }

  func reconcile(
    activityId: String?,
    startedAtISO: String,
    elapsedSeconds: Double,
    isPaused: Bool,
    snapshot: [String: Any],
    promise: Promise
  ) {
    guard #available(iOS 16.1, *) else {
      promise.resolve(nil)
      return
    }

    Task {
      do {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
          promise.resolve(nil)
          return
        }

        let activities = Activity<ToiletTimerAttributes>.activities
        let retainedActivity = activityId.flatMap { requestedId in
          activities.first { $0.id == requestedId }
        } ?? activities.first
        let elapsed = max(0, elapsedSeconds)
        let state = makeContentState(
          startedAtISO: startedAtISO,
          elapsedSeconds: elapsed,
          isPaused: isPaused,
          snapshot: snapshot
        )

        if let retainedActivity {
          await endExistingActivities(except: retainedActivity.id)
          await retainedActivity.update(using: state)
          promise.resolve(retainedActivity.id)
          return
        }

        let activity = try Activity<ToiletTimerAttributes>.request(
          attributes: ToiletTimerAttributes(title: "蹲会儿"),
          contentState: state,
          pushType: nil
        )
        promise.resolve(activity.id)
      } catch {
        promise.reject("toilet_live_activity_reconcile_failed", error.localizedDescription)
      }
    }
  }

  @available(iOS 16.1, *)
  private func activity(with id: String) -> Activity<ToiletTimerAttributes>? {
    Activity<ToiletTimerAttributes>.activities.first { $0.id == id }
  }

  @available(iOS 16.1, *)
  private func endExistingActivities(except retainedActivityId: String? = nil) async {
    for activity in Activity<ToiletTimerAttributes>.activities where activity.id != retainedActivityId {
      let state = makeContentState(elapsedSeconds: 0, isPaused: true, snapshot: nil)
      await activity.end(using: state, dismissalPolicy: .immediate)
    }
  }

  @available(iOS 16.1, *)
  private func makeContentState(
    startedAtISO: String,
    elapsedSeconds: Double,
    isPaused: Bool,
    snapshot: [String: Any]?
  ) -> ToiletTimerAttributes.ContentState {
    let parsedDate = ISO8601DateFormatter().date(from: startedAtISO)
    let timerStartDate = elapsedSeconds > 0
      ? Date(timeIntervalSinceNow: -elapsedSeconds)
      : (parsedDate ?? Date())

    return makeContentState(
      elapsedSeconds: elapsedSeconds,
      isPaused: isPaused,
      snapshot: snapshot,
      timerStartDate: timerStartDate
    )
  }

  @available(iOS 16.1, *)
  private func makeContentState(
    elapsedSeconds: Double,
    isPaused: Bool,
    snapshot: [String: Any]?
  ) -> ToiletTimerAttributes.ContentState {
    makeContentState(
      elapsedSeconds: elapsedSeconds,
      isPaused: isPaused,
      snapshot: snapshot,
      timerStartDate: Date(timeIntervalSinceNow: -elapsedSeconds)
    )
  }

  @available(iOS 16.1, *)
  private func makeContentState(
    elapsedSeconds: Double,
    isPaused: Bool,
    snapshot: [String: Any]?,
    timerStartDate: Date
  ) -> ToiletTimerAttributes.ContentState {
    let displaySnapshot = makeDisplaySnapshot(elapsedSeconds: elapsedSeconds, snapshot: snapshot)
    return ToiletTimerAttributes.ContentState(
      accumulatedElapsedSeconds: elapsedSeconds,
      isPaused: isPaused,
      nextCueSeconds: displaySnapshot.nextCueSeconds,
      stageKey: displaySnapshot.stageKey,
      stageMessage: displaySnapshot.stageMessage,
      stageTitle: displaySnapshot.stageTitle,
      targetSeconds: displaySnapshot.targetSeconds,
      timerStartDate: timerStartDate
    )
  }

  private func makeDisplaySnapshot(
    elapsedSeconds: Double,
    snapshot: [String: Any]?
  ) -> LiveActivityDisplaySnapshot {
    let fallback = fallbackDisplaySnapshot(for: elapsedSeconds)
    guard let snapshot else {
      return fallback
    }

    return LiveActivityDisplaySnapshot(
      nextCueSeconds: snapshot.doubleValue(forKey: "nextCueSeconds") ?? fallback.nextCueSeconds,
      stageKey: snapshot.stringValue(forKey: "stageKey") ?? fallback.stageKey,
      stageMessage: snapshot.stringValue(forKey: "stageMessage") ?? fallback.stageMessage,
      stageTitle: snapshot.stringValue(forKey: "stageTitle") ?? fallback.stageTitle,
      targetSeconds: snapshot.doubleValue(forKey: "targetSeconds") ?? fallback.targetSeconds
    )
  }

  private func fallbackDisplaySnapshot(for elapsedSeconds: Double) -> LiveActivityDisplaySnapshot {
    let elapsed = max(0, elapsedSeconds)
    let targetSeconds = 20.0 * 60.0
    let nextCueSeconds = [5.0, 10.0, 15.0, 20.0]
      .map { $0 * 60.0 }
      .first { $0 > elapsed } ?? targetSeconds

    let stage: (key: String, message: String)
    switch elapsed {
    case targetSeconds...:
      stage = ("severe_warning", "小花过劳了")
    case (15.0 * 60.0)..<targetSeconds:
      stage = ("overtime", "小花过劳了")
    case (10.0 * 60.0)..<(15.0 * 60.0):
      stage = ("strong_warning", "别再加班了")
    case (5.0 * 60.0)..<(10.0 * 60.0):
      stage = ("gentle_warning", "小花该下班了")
    default:
      stage = ("normal", "小花值班中")
    }

    return LiveActivityDisplaySnapshot(
      nextCueSeconds: nextCueSeconds,
      stageKey: stage.key,
      stageMessage: stage.message,
      stageTitle: stage.message,
      targetSeconds: targetSeconds
    )
  }
}

private struct LiveActivityDisplaySnapshot {
  let nextCueSeconds: Double
  let stageKey: String
  let stageMessage: String
  let stageTitle: String
  let targetSeconds: Double
}

private extension Dictionary where Key == String, Value == Any {
  func stringValue(forKey key: String) -> String? {
    guard let value = self[key] as? String else {
      return nil
    }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }

  func doubleValue(forKey key: String) -> Double? {
    if let value = self[key] as? NSNumber {
      return value.doubleValue
    }
    if let value = self[key] as? Double {
      return value
    }
    if let value = self[key] as? String {
      return Double(value)
    }
    return nil
  }
}
