import Foundation
import WidgetKit

struct WatchStateStore {
  func load() -> WatchTodayState {
    WatchSharedStateStore.load() ?? .placeholder
  }

  func save(_ state: WatchTodayState) {
    WatchSharedStateStore.save(state)
    WidgetCenter.shared.reloadTimelines(ofKind: WatchSharedStateStore.widgetKind)
  }
}
