import SwiftUI
import WatchKit

struct WatchHabitsView: View {
  @EnvironmentObject private var session: WatchSessionManager

  private let items: [WatchHabitItem] = [
    WatchHabitItem(key: "water", title: "喝水", detail: "8 杯"),
    WatchHabitItem(key: "fiber", title: "纤维", detail: "2 餐+"),
    WatchHabitItem(key: "movement", title: "活动", detail: "30 分钟"),
    WatchHabitItem(key: "bowel", title: "顺畅", detail: "少用力"),
  ]

  var body: some View {
    Group {
      if !session.todayState.isPro {
        WatchProLockedContent()
      } else {
        List(items) { item in
          let isDone = item.isDone(in: session.todayState)

          Button {
            WKInterfaceDevice.current().play(.click)
            session.sendHabitToggle(habitKey: item.key, level: isDone ? nil : "good")
          } label: {
            HStack {
              VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                  .fontWeight(.semibold)
                Text(isDone ? "已达标" : item.detail)
                  .font(.caption2)
                  .foregroundStyle(.secondary)
              }

              Spacer()

              Image(systemName: isDone ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(isDone ? .green : .secondary)
            }
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
