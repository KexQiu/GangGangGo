import ExpoModulesCore
import Foundation
import WatchConnectivity

public final class GangGangGoWatchConnectivityModule: Module {
  private let client = WatchConnectivityClient()

  public func definition() -> ModuleDefinition {
    Name("GangGangGoWatchConnectivity")
    Events("onWatchConnectivityEvent")

    OnStartObserving {
      self.client.setObserving(true)
      self.client.onEvent = { [weak self] payload in
        self?.sendEvent("onWatchConnectivityEvent", payload)
      }
    }
    OnStopObserving {
      self.client.setObserving(false)
      self.client.onEvent = nil
    }

    AsyncFunction("activate") { (promise: Promise) in
      self.client.activate(promise)
    }
    AsyncFunction("getLastReachability") { (promise: Promise) in
      self.client.getLastReachability(promise)
    }
    AsyncFunction("getDebugInfo") { (promise: Promise) in
      self.client.getDebugInfo(promise)
    }
    AsyncFunction("sendTodayState") { (state: [String: Any], promise: Promise) in
      self.client.sendTodayState(state, promise: promise)
    }
    AsyncFunction("replyToWatchMessage") { (replyId: String, ack: [String: Any], promise: Promise) in
      self.client.replyToWatchMessage(replyId, ack: ack, promise: promise)
    }
  }
}

private final class WatchConnectivityClient: NSObject, WCSessionDelegate {
  private var activationCompletions: [(Bool, Error?) -> Void] = []
  private var hasListeners = false
  private var isActivating = false
  private var lastTodayStatePayload: [String: Any]?
  private var pendingReplies: [String: ([String: Any]) -> Void] = [:]
  private var pendingReplyTimeouts: [String: DispatchWorkItem] = [:]
  private let session: WCSession? = WCSession.isSupported() ? WCSession.default : nil
  var onEvent: (([String: Any]) -> Void)?

  func setObserving(_ observing: Bool) {
    hasListeners = observing
  }

  func activate(_ promise: Promise) {
    activateSession { isActivated, _ in
      promise.resolve(isActivated)
    }
  }

  func getLastReachability(_ promise: Promise) {
    activateSession { _, _ in
      promise.resolve(self.reachabilityPayload())
    }
  }

  func getDebugInfo(_ promise: Promise) {
    activateSession { _, error in
      var payload = self.reachabilityPayload()
      payload["activationError"] = error?.localizedDescription
      payload["activationState"] = self.activationStateDescription()
      payload["embeddedWatchBundleIdentifiers"] = self.embeddedWatchBundleIdentifiers()
      payload["iPhoneBundleIdentifier"] = Bundle.main.bundleIdentifier
      payload["isSessionSupported"] = WCSession.isSupported()
      promise.resolve(payload)
    }
  }

  func sendTodayState(_ state: [String: Any], promise: Promise) {
    activateSession { isActivated, error in
      guard isActivated, let session = self.session else {
        promise.resolve(["reason": error?.localizedDescription ?? "watch_session_unavailable", "sent": false])
        return
      }
      guard session.isPaired else {
        promise.resolve(["reason": "watch_not_paired", "sent": false])
        return
      }
      guard session.isWatchAppInstalled else {
        promise.resolve(["reason": "watch_app_not_installed", "sent": false])
        return
      }

      let statePayload = self.sanitizedDictionary(state)
      var payload: [String: Any] = [
        "schemaVersion": 2,
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
        promise.resolve(["sent": true])
      } catch {
        promise.resolve(["reason": error.localizedDescription, "sent": false])
      }
    }
  }

  func replyToWatchMessage(_ replyId: String, ack: [String: Any], promise: Promise) {
    DispatchQueue.main.async {
      self.completePendingReply(replyId, response: self.sanitizedDictionary(ack))
      promise.resolve(nil)
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
      completions.forEach { $0(activationState == .activated, error) }
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

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
      if message["type"] as? String == "request_today_state", let state = self.lastTodayStatePayload {
        var reply = state
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
    onEvent?(message)
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
      return ["isPaired": false, "isReachable": false, "isWatchAppInstalled": false]
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
    return watchAppURLs.compactMap { Bundle(url: $0)?.bundleIdentifier }
  }

  private func sanitizedDictionary(_ dictionary: [String: Any]) -> [String: Any] {
    dictionary.reduce(into: [:]) { result, entry in
      if let value = sanitizedValue(entry.value) {
        result[entry.key] = value
      }
    }
  }

  private func sanitizedValue(_ value: Any) -> Any? {
    if value is NSNull {
      return nil
    }
    if let dictionary = value as? [String: Any] {
      return sanitizedDictionary(dictionary)
    }
    if let array = value as? [Any] {
      return array.compactMap(sanitizedValue)
    }
    return value
  }
}
