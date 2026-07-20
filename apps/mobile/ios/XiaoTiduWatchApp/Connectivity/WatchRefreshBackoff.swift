import Foundation

struct WatchRefreshBackoff: Equatable, Sendable {
  private(set) var nextDelay: TimeInterval = 5

  mutating func reset() {
    nextDelay = 5
  }

  mutating func takeNextDelay(isApplicationActive: Bool) -> TimeInterval? {
    guard isApplicationActive else {
      return nil
    }

    let delay = nextDelay
    nextDelay = min(nextDelay * 2, 30)
    return delay
  }
}
