import SwiftUI

@main
struct XiaoTiduWatchApp: App {
  @StateObject private var sessionManager = WatchSessionManager()

  var body: some Scene {
    WindowGroup {
      WatchHomeView()
        .environmentObject(sessionManager)
    }
  }
}
