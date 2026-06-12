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

        if session.todayState.isPro {
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
        } else {
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
    if !session.todayState.isPro {
      return "\(session.todayState.toilet.sessionCount) 次"
    }

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
