import Foundation
import React
import WatchConnectivity

@objc(WatchConnectivityModule)
class WatchConnectivityModule: RCTEventEmitter, WCSessionDelegate {
  private let eventName = "WatchConnectivityEvent"
  private var hasListeners = false
  private var lastTodayStatePayload: [String: Any]?
  private var pendingReplies: [String: ([String: Any]) -> Void] = [:]
  private var pendingReplyTimeouts: [String: DispatchWorkItem] = [:]
  private let session: WCSession? = WCSession.isSupported() ? WCSession.default : nil

  @objc
  override static func requiresMainQueueSetup() -> Bool {
    false
  }

  override func supportedEvents() -> [String]! {
    [eventName]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  @objc(activate:rejecter:)
  func activate(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard configureSession() else {
      resolve(false)
      return
    }

    session?.activate()
    resolve(true)
  }

  @objc(getLastReachability:rejecter:)
  func getLastReachability(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(reachabilityPayload())
  }

  @objc(sendTodayState:resolver:rejecter:)
  func sendTodayState(
    _ state: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard configureSession(), let session else {
      resolve(nil)
      return
    }

    guard session.isPaired else {
      resolve([
        "reason": "watch_not_paired",
        "sent": false,
      ])
      return
    }

    if session.activationState == .notActivated {
      session.activate()
    }

    let statePayload = sanitizedDictionary(state)
    var payload: [String: Any] = [
      "sentAt": ISO8601DateFormatter().string(from: Date()),
      "state": statePayload,
      "type": "today_state",
    ]
    if let stateJson = state["stateJson"] as? String {
      payload["stateJson"] = stateJson
    }
    lastTodayStatePayload = payload

    do {
      try session.updateApplicationContext(payload)
      session.transferUserInfo(payload)
      if session.isReachable {
        session.sendMessage(payload, replyHandler: nil, errorHandler: nil)
      }
      resolve([
        "sent": true,
      ])
    } catch {
      resolve([
        "reason": error.localizedDescription,
        "sent": false,
      ])
    }
  }

  @objc(replyToWatchMessage:ack:resolver:rejecter:)
  func replyToWatchMessage(
    _ replyId: NSString,
    ack: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      self.completePendingReply(replyId as String, response: self.sanitizedDictionary(ack))
      resolve(nil)
    }
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    // React Native polls reachability for now. Watch-originated events will be bridged in the watchOS target phase.
  }

  func sessionDidBecomeInactive(_ session: WCSession) {
    // Required by WCSessionDelegate on iOS.
  }

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    emitIncomingMessage(message)
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    DispatchQueue.main.async {
      guard self.hasListeners else {
        if (message["type"] as? String) == "request_today_state", let statePayload = self.lastTodayStatePayload {
          var reply = statePayload
          reply["eventId"] = "request_today_state"
          reply["repliedAt"] = ISO8601DateFormatter().string(from: Date())
          reply["status"] = "accepted"
          replyHandler(reply)
          return
        }

        replyHandler([
          "message": "iPhone 暂时没有准备好处理手表操作。",
          "repliedAt": ISO8601DateFormatter().string(from: Date()),
          "status": "rejected",
        ])
        return
      }

      let replyId = UUID().uuidString
      var emittedMessage = message
      emittedMessage["replyId"] = replyId
      self.pendingReplies[replyId] = replyHandler

      let timeout = DispatchWorkItem { [weak self] in
        self?.completePendingReply(replyId, response: [
          "message": "iPhone 处理超时，稍后会重新同步。",
          "status": "rejected",
        ])
      }
      self.pendingReplyTimeouts[replyId] = timeout
      DispatchQueue.main.asyncAfter(deadline: .now() + 20, execute: timeout)
      self.emitIncomingMessage(emittedMessage)
    }
  }

  @discardableResult
  private func configureSession() -> Bool {
    guard let session else {
      return false
    }

    session.delegate = self

    return true
  }

  private func emitIncomingMessage(_ message: [String: Any]) {
    guard hasListeners else {
      return
    }

    sendEvent(withName: eventName, body: message)
  }

  private func completePendingReply(_ replyId: String, response: [String: Any]) {
    guard let replyHandler = pendingReplies.removeValue(forKey: replyId) else {
      return
    }

    pendingReplyTimeouts.removeValue(forKey: replyId)?.cancel()

    var reply = response
    reply["repliedAt"] = ISO8601DateFormatter().string(from: Date())
    replyHandler(reply)
  }

  private func reachabilityPayload() -> [String: Any] {
    guard let session else {
      return [
        "isPaired": false,
        "isReachable": false,
        "isWatchAppInstalled": false,
      ]
    }

    return [
      "isPaired": session.isPaired,
      "isReachable": session.isReachable,
      "isWatchAppInstalled": session.isWatchAppInstalled,
    ]
  }

  private func sanitizedDictionary(_ dictionary: NSDictionary) -> [String: Any] {
    var result: [String: Any] = [:]

    for (key, value) in dictionary {
      guard let key = key as? String, let sanitizedValue = sanitizedValue(value) else {
        continue
      }

      result[key] = sanitizedValue
    }

    return result
  }

  private func sanitizedValue(_ value: Any) -> Any? {
    if value is NSNull {
      return nil
    }

    if let dictionary = value as? NSDictionary {
      return sanitizedDictionary(dictionary)
    }

    if let array = value as? NSArray {
      return array.compactMap { sanitizedValue($0) }
    }

    return value
  }
}
