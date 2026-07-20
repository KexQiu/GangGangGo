import Foundation
import WidgetKit

struct WatchStateStore {
  private let legacyStorageKey = "xiaotidu-watch-today-state"

  func load() -> WatchTodayState {
    if let state = WatchSharedStateStore.load() {
      return state
    }

    guard let data = UserDefaults.standard.data(forKey: legacyStorageKey),
          let state = try? JSONDecoder().decode(WatchTodayState.self, from: data) else {
      return .placeholder
    }

    return state
  }

  func save(_ state: WatchTodayState) {
    guard let data = try? JSONEncoder().encode(state) else {
      return
    }

    UserDefaults.standard.set(data, forKey: legacyStorageKey)
    WatchSharedStateStore.save(state)
    WidgetCenter.shared.reloadTimelines(ofKind: WatchSharedStateStore.widgetKind)
  }
}
