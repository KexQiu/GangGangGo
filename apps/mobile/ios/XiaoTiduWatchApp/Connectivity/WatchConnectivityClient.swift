import Foundation
import WatchConnectivity

final class WatchConnectivityClient: NSObject {
  var onActivationCompleted: ((Error?) -> Void)?
  var onPayloadReceived: (([String: Any]) -> Void)?
  var onReachabilityChanged: ((Bool) -> Void)?

  private let session: WCSession? = WCSession.isSupported() ? WCSession.default : nil

  var isReachable: Bool {
    session?.isReachable == true
  }

  var isReadyToSend: Bool {
    session?.activationState == .activated && isReachable
  }

  var isSupported: Bool {
    session != nil
  }

  func activate() {
    guard let session else {
      return
    }

    session.delegate = self
    session.activate()
  }

  func sendMessage(
    _ message: [String: Any],
    completion: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    guard let session, session.activationState == .activated, session.isReachable else {
      completion(.failure(WatchConnectivityClientError.notReachable))
      return
    }

    session.sendMessage(
      message,
      replyHandler: { reply in
        DispatchQueue.main.async {
          completion(.success(reply))
        }
      },
      errorHandler: { error in
        DispatchQueue.main.async {
          completion(.failure(error))
        }
      }
    )
  }
}

extension WatchConnectivityClient: WCSessionDelegate {
  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    DispatchQueue.main.async { [weak self] in
      self?.onActivationCompleted?(error)
      self?.onReachabilityChanged?(session.isReachable)
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    DispatchQueue.main.async { [weak self] in
      self?.onReachabilityChanged?(session.isReachable)
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    deliver(applicationContext)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    deliver(userInfo)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    deliver(message)
  }

  private func deliver(_ payload: [String: Any]) {
    DispatchQueue.main.async { [weak self] in
      self?.onPayloadReceived?(payload)
    }
  }
}

private enum WatchConnectivityClientError: LocalizedError {
  case notReachable

  var errorDescription: String? {
    "iPhone is not reachable."
  }
}
