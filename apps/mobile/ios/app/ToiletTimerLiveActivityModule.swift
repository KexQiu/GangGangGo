import ActivityKit
import Foundation
import React

@objc(ToiletTimerLiveActivityModule)
class ToiletTimerLiveActivityModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(isSupported:rejecter:)
  func isSupported(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(false)
      return
    }

    resolve(ActivityAuthorizationInfo().areActivitiesEnabled)
  }

  @objc(start:elapsedSeconds:snapshot:resolver:rejecter:)
  func start(
    _ startedAtISO: String,
    elapsedSeconds: NSNumber,
    snapshot: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(nil)
      return
    }

    Task {
      do {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
          reject("toilet_live_activity_disabled", "Live Activity is disabled for this app or device.", nil)
          return
        }

        await endExistingActivities()

        let elapsed = max(0, elapsedSeconds.doubleValue)
        let state = makeContentState(
          startedAtISO: startedAtISO,
          elapsedSeconds: elapsed,
          isPaused: false,
          snapshot: snapshot
        )
        let attributes = ToiletTimerAttributes(title: "蹲会儿")
        let activity = try Activity<ToiletTimerAttributes>.request(
          attributes: attributes,
          contentState: state,
          pushType: nil
        )

        resolve(activity.id)
      } catch {
        reject("toilet_live_activity_start_failed", error.localizedDescription, error)
      }
    }
  }

  @objc(pause:elapsedSeconds:snapshot:resolver:rejecter:)
  func pause(
    _ activityId: String,
    elapsedSeconds: NSNumber,
    snapshot: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(nil)
      return
    }

    update(
      activityId: activityId,
      elapsedSeconds: elapsedSeconds.doubleValue,
      isPaused: true,
      snapshot: snapshot,
      resolve: resolve,
      reject: reject
    )
  }

  @objc(resume:elapsedSeconds:snapshot:resolver:rejecter:)
  func resume(
    _ activityId: String,
    elapsedSeconds: NSNumber,
    snapshot: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(nil)
      return
    }

    update(
      activityId: activityId,
      elapsedSeconds: elapsedSeconds.doubleValue,
      isPaused: false,
      snapshot: snapshot,
      resolve: resolve,
      reject: reject
    )
  }

  @objc(sync:elapsedSeconds:isPaused:snapshot:resolver:rejecter:)
  func sync(
    _ activityId: String,
    elapsedSeconds: NSNumber,
    isPaused: Bool,
    snapshot: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(nil)
      return
    }

    update(
      activityId: activityId,
      elapsedSeconds: elapsedSeconds.doubleValue,
      isPaused: isPaused,
      snapshot: snapshot,
      resolve: resolve,
      reject: reject
    )
  }

  @objc(end:elapsedSeconds:snapshot:resolver:rejecter:)
  func end(
    _ activityId: String,
    elapsedSeconds: NSNumber,
    snapshot: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(nil)
      return
    }

    Task {
      guard let activity = activity(with: activityId) else {
        resolve(nil)
        return
      }

      let state = makeContentState(
        elapsedSeconds: max(0, elapsedSeconds.doubleValue),
        isPaused: true,
        snapshot: snapshot
      )
      await activity.end(using: state, dismissalPolicy: .immediate)
      resolve(nil)
    }
  }

  @available(iOS 16.1, *)
  private func update(
    activityId: String,
    elapsedSeconds: Double,
    isPaused: Bool,
    snapshot: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      guard let activity = activity(with: activityId) else {
        resolve(nil)
        return
      }

      let state = makeContentState(
        elapsedSeconds: max(0, elapsedSeconds),
        isPaused: isPaused,
        snapshot: snapshot
      )
      await activity.update(using: state)
      resolve(nil)
    }
  }

  @available(iOS 16.1, *)
  private func activity(with id: String) -> Activity<ToiletTimerAttributes>? {
    Activity<ToiletTimerAttributes>.activities.first { $0.id == id }
  }

  @available(iOS 16.1, *)
  private func endExistingActivities() async {
    for activity in Activity<ToiletTimerAttributes>.activities {
      let state = makeContentState(elapsedSeconds: 0, isPaused: true, snapshot: nil)
      await activity.end(using: state, dismissalPolicy: .immediate)
    }
  }

  @available(iOS 16.1, *)
  private func makeContentState(
    startedAtISO: String,
    elapsedSeconds: Double,
    isPaused: Bool,
    snapshot: NSDictionary?
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
    snapshot: NSDictionary?
  ) -> ToiletTimerAttributes.ContentState {
    return makeContentState(
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
    snapshot: NSDictionary?,
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

  private func makeDisplaySnapshot(elapsedSeconds: Double, snapshot: NSDictionary?) -> LiveActivityDisplaySnapshot {
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
    let normalizedElapsedSeconds = max(0, elapsedSeconds)
    let targetSeconds = 20.0 * 60.0
    let nextCueSeconds = [5.0, 10.0, 15.0, 20.0]
      .map { $0 * 60.0 }
      .first { $0 > normalizedElapsedSeconds } ?? targetSeconds

    if normalizedElapsedSeconds >= targetSeconds {
      return LiveActivityDisplaySnapshot(
        nextCueSeconds: targetSeconds,
        stageKey: "severe_warning",
        stageMessage: "小花过劳了",
        stageTitle: "小花过劳了",
        targetSeconds: targetSeconds
      )
    }

    if normalizedElapsedSeconds >= 15.0 * 60.0 {
      return LiveActivityDisplaySnapshot(
        nextCueSeconds: nextCueSeconds,
        stageKey: "overtime",
        stageMessage: "小花过劳了",
        stageTitle: "小花过劳了",
        targetSeconds: targetSeconds
      )
    }

    if normalizedElapsedSeconds >= 10.0 * 60.0 {
      return LiveActivityDisplaySnapshot(
        nextCueSeconds: nextCueSeconds,
        stageKey: "strong_warning",
        stageMessage: "别再加班了",
        stageTitle: "别再加班了",
        targetSeconds: targetSeconds
      )
    }

    if normalizedElapsedSeconds >= 5.0 * 60.0 {
      return LiveActivityDisplaySnapshot(
        nextCueSeconds: nextCueSeconds,
        stageKey: "gentle_warning",
        stageMessage: "小花该下班了",
        stageTitle: "小花该下班了",
        targetSeconds: targetSeconds
      )
    }

    return LiveActivityDisplaySnapshot(
      nextCueSeconds: nextCueSeconds,
      stageKey: "normal",
      stageMessage: "小花值班中",
      stageTitle: "小花值班中",
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

private extension NSDictionary {
  func stringValue(forKey key: String) -> String? {
    guard let value = self[key] as? String else {
      return nil
    }

    let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmedValue.isEmpty ? nil : trimmedValue
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
