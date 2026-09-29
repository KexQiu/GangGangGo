import SwiftUI
import WatchKit

struct WatchHabitsView: View {
  @EnvironmentObject private var session: WatchSessionManager

  private let items: [WatchHabitItem] = [
    WatchHabitItem(key: "water", title: "喝水", detail: "8 杯及以上"),
    WatchHabitItem(key: "fiber", title: "蔬果全谷", detail: "较丰富"),
    WatchHabitItem(key: "movement", title: "活动", detail: "至少30分钟"),
    WatchHabitItem(key: "bowel", title: "排便", detail: "顺畅"),
  ]

  var body: some View {
    Group {
      if !session.todayState.canUseActions {
        WatchActionLockedContent()
      } else {
        List {
          Section {
            ForEach(items) { item in
              let isDone = item.isDone(in: session.todayState)

              Button {
                WKInterfaceDevice.current().play(.click)
                session.sendHabitToggle(habitKey: item.key, level: isDone ? nil : "good")
              } label: {
                HStack {
                  VStack(alignment: .leading, spacing: 3) {
                    Text(item.title)
                      .fontWeight(.semibold)
                    Text(isDone ? "已记录" : item.detail)
                      .font(.caption2)
                      .foregroundStyle(.secondary)
                  }

                  Spacer()

                  Image(systemName: isDone ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isDone ? .green : .secondary)
                }
              }
            }
          } footer: {
            Text("已记录不代表健康达标。空项按所示分档快捷记录，已记录项点按撤销；其他分档及今日未排便请在手机填写。")
          }
        }
      }
    }
    .navigationTitle("小账本")
  }
}

private struct WatchHabitItem: Identifiable {
  var id: String {
    key
  }

  var key: String
  var title: String
  var detail: String

  func isDone(in state: WatchTodayState) -> Bool {
    switch key {
    case "water":
      return state.habits.waterDone
    case "fiber":
      return state.habits.fiberDone
    case "movement":
      return state.habits.movementDone
    case "bowel":
      return state.habits.bowelDone
    default:
      return false
    }
  }
}
