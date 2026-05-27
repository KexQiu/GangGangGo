import Foundation
import SwiftUI

struct WatchHomeView: View {
  @EnvironmentObject private var session: WatchSessionManager
  @State private var now = Date()

  private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

  var body: some View {
    NavigationStack {
      List {
        Section {
          StatusTile(title: "菊花抬", value: trainingValue)
          StatusTile(title: "小账本", value: "\(session.todayState.habits.completion)/4")
          StatusTile(title: "蹲会儿", value: toiletValue)
        }

        Section {
          NavigationLink("开始菊花抬") {
            WatchTrainingView()
          }
          NavigationLink("小账本快记") {
            WatchHabitsView()
          }
          NavigationLink("蹲会儿状态") {
            WatchToiletView()
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
        }
      }
      .navigationTitle("小提督")
    }
    .onReceive(tick) { date in
      now = date
    }
  }

  private var connectivityText: String {
    if session.isReachable {
      return "iPhone 在线"
    }

    return session.pendingEventCount > 0 ? "待同步 \(session.pendingEventCount) 条" : "等待 iPhone"
  }

  private var toiletValue: String {
    guard session.todayState.toilet.isRunning else {
      return "未进行"
    }

    let elapsedSeconds = session.todayState.currentToiletElapsedSeconds(now: now)
    let minutes = elapsedSeconds / 60
    let seconds = elapsedSeconds % 60
    let time = "\(minutes):\(String(format: "%02d", seconds))"

    return session.todayState.toilet.isPaused ? "\(time) 暂停" : "\(time)"
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
