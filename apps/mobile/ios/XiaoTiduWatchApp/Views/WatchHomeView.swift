import Foundation
import SwiftUI

private enum WatchRoute: Hashable {
  case training
  case habits
  case toilet
}

private enum WatchDeepLink {
  static let scheme = "xiaotidu-watch"

  static func route(from url: URL) -> WatchRoute? {
    guard url.scheme == scheme else {
      return nil
    }

    let routeName = url.host ?? url.pathComponents.dropFirst().first ?? ""

    switch routeName {
    case "training":
      return .training
    case "habits":
      return .habits
    case "toilet":
      return .toilet
    default:
      return nil
    }
  }

  static func isHome(_ url: URL) -> Bool {
    guard url.scheme == scheme else {
      return false
    }

    return url.host == "home" || url.pathComponents.dropFirst().first == "home"
  }
}

struct WatchHomeView: View {
  @EnvironmentObject private var session: WatchSessionManager
  @State private var path: [WatchRoute] = []

  var body: some View {
    NavigationStack(path: $path) {
      List {
        Section {
          statusRows
        }

        if !session.todayState.isPro {
          Section {
            VStack(alignment: .leading, spacing: 5) {
              Text(session.todayState.proLockedTitle)
                .fontWeight(.semibold)
              Text(session.todayState.proLockedBody)
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
          }
        }

        Section {
          Text(connectivityText)
            .font(.footnote)
            .foregroundStyle(.secondary)

          if let lastAckMessage = session.lastAckMessage {
            Text(lastAckMessage)
              .font(.footnote)
              .foregroundStyle(.green)
          }

          if let lastError = session.lastError {
            Text(lastError)
              .font(.footnote)
              .foregroundStyle(.orange)
          }

          if let lastSyncedAt = session.lastSyncedAt {
            Text("上次同步 \(lastSyncedAt.formatted(date: .omitted, time: .standard))")
              .font(.caption2)
              .foregroundStyle(.secondary)
          }
        } header: {
          Text("同步")
        }

        if session.pendingEventCount > 0 {
          Section {
            ForEach(Array(session.pendingEventSummaries.enumerated()), id: \.offset) { _, summary in
              Label(summary, systemImage: "clock.arrow.circlepath")
                .font(.caption)
            }
          } header: {
            Text("待同步队列")
          } footer: {
            Text("iPhone 回到前台后会自动补同步。")
          }
        }
      }
      .navigationTitle("小提督")
      .navigationDestination(for: WatchRoute.self) { route in
        destination(for: route)
      }
      .onOpenURL { url in
        handleDeepLink(url)
      }
    }
  }

  @ViewBuilder
  private var statusRows: some View {
    if session.todayState.isPro {
      NavigationLink(value: WatchRoute.training) {
        StatusTile(title: "菊花抬", value: trainingValue)
      }

      NavigationLink(value: WatchRoute.habits) {
        StatusTile(title: "小账本", value: "\(session.todayState.habits.completion)/4")
      }

      NavigationLink(value: WatchRoute.toilet) {
        StatusTile(title: "蹲会儿", value: toiletValue)
      }
    } else {
      StatusTile(title: "菊花抬", value: trainingValue)
      StatusTile(title: "小账本", value: "\(session.todayState.habits.completion)/4")
      StatusTile(title: "蹲会儿", value: toiletValue)
    }
  }

  @ViewBuilder
  private func destination(for route: WatchRoute) -> some View {
    switch route {
    case .training:
      WatchTrainingView()
    case .habits:
      WatchHabitsView()
    case .toilet:
      WatchToiletView()
    }
  }

  private func handleDeepLink(_ url: URL) {
    if WatchDeepLink.isHome(url) {
      path.removeAll()
      return
    }

    guard let route = WatchDeepLink.route(from: url), canOpen(route) else {
      return
    }

    path = [route]
  }

  private func canOpen(_ route: WatchRoute) -> Bool {
    guard session.todayState.isPro else {
      return false
    }

    if route == .toilet {
      return session.todayState.toilet.isRunning
    }

    return true
  }

  private var connectivityText: String {
    if session.isReachable {
      return "iPhone 在线"
    }

    return session.pendingEventCount > 0 ? "待同步 \(session.pendingEventCount) 条" : "等待 iPhone"
  }

  private var toiletValue: String {
    "\(session.todayState.toilet.sessionCount) 次"
  }

  private var trainingValue: String {
    session.todayState.training.done
      ? "已完成"
      : "\(session.todayState.training.completedSets) 组"
  }
}

private struct StatusTile: View {
  var title: String
  var value: String

  var body: some View {
    HStack {
      Text(title)
      Spacer()
      Text(value)
        .fontWeight(.semibold)
        .foregroundStyle(.green)
    }
  }
}

struct WatchProLockedContent: View {
  @EnvironmentObject private var session: WatchSessionManager

  var body: some View {
    VStack(spacing: 10) {
      Image(systemName: "lock.circle.fill")
        .font(.system(size: 34, weight: .bold))
        .foregroundStyle(.yellow)

      Text(session.todayState.proLockedTitle)
        .font(.headline)

      Text(session.todayState.proLockedBody)
        .font(.caption)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
    }
    .padding()
  }
}
