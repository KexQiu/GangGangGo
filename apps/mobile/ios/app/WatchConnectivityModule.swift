import Foundation
import React
import WatchConnectivity

@objc(WatchConnectivityModule)
class WatchConnectivityModule: RCTEventEmitter, WCSessionDelegate {
  private let eventName = "WatchConnectivityEvent"
  private var hasListeners = false
  private var activationCompletions: [(Bool, Error?) -> Void] = []
  private var isActivating = false
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
    activateSession { isActivated, _ in
      resolve(isActivated)
    }
  }

  @objc(getLastReachability:rejecter:)
  func getLastReachability(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    activateSession { _, _ in
      resolve(self.reachabilityPayload())
    }
  }

  @objc(getDebugInfo:rejecter:)
  func getDebugInfo(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    activateSession { _, error in
      var payload = self.reachabilityPayload()
      payload["activationError"] = error?.localizedDescription
      payload["activationState"] = self.activationStateDescription()
      payload["embeddedWatchBundleIdentifiers"] = self.embeddedWatchBundleIdentifiers()
      payload["iPhoneBundleIdentifier"] = Bundle.main.bundleIdentifier
      payload["isSessionSupported"] = WCSession.isSupported()
      resolve(payload)
    }
  }

  @objc(sendTodayState:resolver:rejecter:)
  func sendTodayState(
    _ state: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    activateSession { isActivated, error in
      guard isActivated, let session = self.session else {
        resolve([
          "reason": error?.localizedDescription ?? "watch_session_unavailable",
          "sent": false,
        ])
        return
      }

      guard session.isPaired else {
        resolve([
          "reason": "watch_not_paired",
          "sent": false,
        ])
        return
      }

      guard session.isWatchAppInstalled else {
        resolve([
          "reason": "watch_app_not_installed",
          "sent": false,
        ])
        return
      }

      let statePayload = self.sanitizedDictionary(state)
      var payload: [String: Any] = [
        "sentAt": ISO8601DateFormatter().string(from: Date()),
        "state": statePayload,
        "type": "today_state",
      ]
      if let stateJson = state["stateJson"] as? String {
        payload["stateJson"] = stateJson
      }
      self.lastTodayStatePayload = payload

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
    DispatchQueue.main.async {
      let completions = self.activationCompletions
      self.activationCompletions.removeAll()
      self.isActivating = false
      completions.forEach { completion in
        completion(activationState == .activated, error)
      }
    }
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
      if (message["type"] as? String) == "request_today_state", let statePayload = self.lastTodayStatePayload {
        var reply = statePayload
        reply["eventId"] = "request_today_state"
        reply["repliedAt"] = ISO8601DateFormatter().string(from: Date())
        reply["status"] = "accepted"
        replyHandler(reply)
        return
      }

      guard self.hasListeners else {
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

  private func activateSession(completion: @escaping (Bool, Error?) -> Void) {
    DispatchQueue.main.async {
      guard self.configureSession(), let session = self.session else {
        completion(false, nil)
        return
      }

      if session.activationState == .activated {
        completion(true, nil)
        return
      }

      self.activationCompletions.append(completion)

      guard !self.isActivating else {
        return
      }

      self.isActivating = true
      session.activate()
    }
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

  private func activationStateDescription() -> String {
    guard let session else {
      return "unsupported"
    }

    switch session.activationState {
    case .activated:
      return "activated"
    case .inactive:
      return "inactive"
    case .notActivated:
      return "not_activated"
    @unknown default:
      return "unknown"
    }
  }

  private func embeddedWatchBundleIdentifiers() -> [String] {
    let watchURL = Bundle.main.bundleURL.appendingPathComponent("Watch", isDirectory: true)
    guard let watchAppURLs = try? FileManager.default.contentsOfDirectory(
      at: watchURL,
      includingPropertiesForKeys: nil
    ) else {
      return []
    }

    return watchAppURLs.compactMap { url in
      Bundle(url: url)?.bundleIdentifier
    }
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
