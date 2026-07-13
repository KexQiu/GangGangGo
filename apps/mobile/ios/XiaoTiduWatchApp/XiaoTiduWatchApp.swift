import SwiftUI

@main
struct XiaoTiduWatchApp: App {
  @Environment(\.scenePhase) private var scenePhase
  @StateObject private var sessionManager = WatchSessionManager()

  var body: some Scene {
    WindowGroup {
      WatchHomeView()
        .environmentObject(sessionManager)
        .onChange(of: scenePhase) { _, phase in
          sessionManager.setApplicationActive(phase == .active)
        }
    }
  }
}
