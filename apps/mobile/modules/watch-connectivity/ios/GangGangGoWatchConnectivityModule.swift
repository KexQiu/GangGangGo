import ExpoModulesCore

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
