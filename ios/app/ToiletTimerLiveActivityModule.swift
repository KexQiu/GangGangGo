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

  @objc(start:elapsedSeconds:resolver:rejecter:)
  func start(
    _ startedAtISO: String,
    elapsedSeconds: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(nil)
      return
    }

    Task {
      do {
        await endExistingActivities()

        let elapsed = max(0, elapsedSeconds.doubleValue)
        let state = makeContentState(startedAtISO: startedAtISO, elapsedSeconds: elapsed, isPaused: false)
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

  @objc(pause:elapsedSeconds:resolver:rejecter:)
  func pause(
    _ activityId: String,
    elapsedSeconds: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    update(activityId: activityId, elapsedSeconds: elapsedSeconds.doubleValue, isPaused: true, resolve: resolve, reject: reject)
  }

  @objc(resume:elapsedSeconds:resolver:rejecter:)
  func resume(
    _ activityId: String,
    elapsedSeconds: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    update(activityId: activityId, elapsedSeconds: elapsedSeconds.doubleValue, isPaused: false, resolve: resolve, reject: reject)
  }

  @objc(end:elapsedSeconds:resolver:rejecter:)
  func end(
    _ activityId: String,
    elapsedSeconds: NSNumber,
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

      let state = makeContentState(elapsedSeconds: max(0, elapsedSeconds.doubleValue), isPaused: true)
      await activity.end(using: state, dismissalPolicy: .immediate)
      resolve(nil)
    }
  }

  @available(iOS 16.1, *)
  private func update(
    activityId: String,
    elapsedSeconds: Double,
    isPaused: Bool,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      guard let activity = activity(with: activityId) else {
        resolve(nil)
        return
      }

      let state = makeContentState(elapsedSeconds: max(0, elapsedSeconds), isPaused: isPaused)
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
      let state = makeContentState(elapsedSeconds: 0, isPaused: true)
      await activity.end(using: state, dismissalPolicy: .immediate)
    }
  }

  @available(iOS 16.1, *)
  private func makeContentState(startedAtISO: String, elapsedSeconds: Double, isPaused: Bool) -> ToiletTimerAttributes.ContentState {
    let parsedDate = ISO8601DateFormatter().date(from: startedAtISO)
    let timerStartDate = elapsedSeconds > 0
      ? Date(timeIntervalSinceNow: -elapsedSeconds)
      : (parsedDate ?? Date())

    return ToiletTimerAttributes.ContentState(
      accumulatedElapsedSeconds: elapsedSeconds,
      isPaused: isPaused,
      timerStartDate: timerStartDate
    )
  }

  @available(iOS 16.1, *)
  private func makeContentState(elapsedSeconds: Double, isPaused: Bool) -> ToiletTimerAttributes.ContentState {
    ToiletTimerAttributes.ContentState(
      accumulatedElapsedSeconds: elapsedSeconds,
      isPaused: isPaused,
      timerStartDate: Date(timeIntervalSinceNow: -elapsedSeconds)
    )
  }
}
