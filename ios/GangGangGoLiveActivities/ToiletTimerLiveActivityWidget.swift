import ActivityKit
import SwiftUI
import WidgetKit

private let appDeepLink = URL(string: "gangganggo://toilet")
private let primaryColor = Color(red: 0.18, green: 0.72, blue: 0.49)
private let warningColor = Color(red: 0.93, green: 0.56, blue: 0.18)
private let dangerColor = Color(red: 0.90, green: 0.28, blue: 0.30)

@main
struct GangGangGoLiveActivitiesBundle: WidgetBundle {
  var body: some Widget {
    ToiletTimerLiveActivityWidget()
  }
}

struct ToiletTimerLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: ToiletTimerAttributes.self) { context in
      LockScreenLiveActivityView(state: context.state)
        .activityBackgroundTint(Color(red: 0.95, green: 0.99, blue: 0.97))
        .activitySystemActionForegroundColor(primaryColor)
        .widgetURL(appDeepLink)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 4) {
            Text("蹲会儿")
              .font(.caption)
              .foregroundStyle(.secondary)
            Text(context.state.isPaused ? "暂停中" : "进行中")
              .font(.headline)
          }
        }

        DynamicIslandExpandedRegion(.trailing) {
          elapsedText(for: context.state)
            .font(.title3.monospacedDigit().weight(.bold))
            .foregroundStyle(timerColor(for: context.state))
        }

        DynamicIslandExpandedRegion(.bottom) {
          Text(statusText(for: context.state))
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      } compactLeading: {
        Text("蹲")
          .font(.caption.weight(.bold))
          .foregroundStyle(primaryColor)
      } compactTrailing: {
        elapsedText(for: context.state)
          .font(.caption2.monospacedDigit().weight(.semibold))
      } minimal: {
        Text("蹲")
          .font(.caption2.weight(.bold))
          .foregroundStyle(primaryColor)
      }
      .widgetURL(appDeepLink)
    }
  }
}

private struct LockScreenLiveActivityView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    HStack(spacing: 14) {
      ZStack {
        Circle()
          .fill(primaryColor.opacity(0.16))
        Text("蹲")
          .font(.headline.weight(.bold))
          .foregroundStyle(primaryColor)
      }
      .frame(width: 44, height: 44)

      VStack(alignment: .leading, spacing: 6) {
        Text("蹲会儿进行中")
          .font(.headline)
        Text(statusText(for: state))
          .font(.caption)
          .foregroundStyle(.secondary)
      }

      Spacer(minLength: 8)

      elapsedText(for: state)
        .font(.title2.monospacedDigit().weight(.bold))
        .foregroundStyle(timerColor(for: state))
    }
    .padding(16)
  }
}

@ViewBuilder
private func elapsedText(for state: ToiletTimerAttributes.ContentState) -> some View {
  if state.isPaused {
    Text(formatElapsed(state.accumulatedElapsedSeconds))
  } else {
    Text(state.timerStartDate, style: .timer)
  }
}

private func formatElapsed(_ seconds: Double) -> String {
  let totalSeconds = max(0, Int(seconds.rounded()))
  let hours = totalSeconds / 3600
  let minutes = (totalSeconds % 3600) / 60
  let seconds = totalSeconds % 60

  if hours > 0 {
    return String(format: "%d:%02d:%02d", hours, minutes, seconds)
  }

  return String(format: "%02d:%02d", minutes, seconds)
}

private func statusText(for state: ToiletTimerAttributes.ContentState) -> String {
  if state.isPaused {
    return "暂停中，回来继续也行。"
  }

  let elapsedSeconds = currentElapsedSeconds(for: state)
  if elapsedSeconds >= 20 * 60 {
    return "超过 20 分钟了，建议先收工。"
  }
  if elapsedSeconds >= 15 * 60 {
    return "这会儿有点长了，办完就撤。"
  }
  if elapsedSeconds >= 10 * 60 {
    return "差不多该收工了。"
  }
  if elapsedSeconds >= 5 * 60 {
    return "小声敲门：正事办完就撤。"
  }

  return "办完就收工，别让小花陪坐太久。"
}

private func timerColor(for state: ToiletTimerAttributes.ContentState) -> Color {
  if state.isPaused {
    return warningColor
  }

  return currentElapsedSeconds(for: state) >= 20 * 60 ? dangerColor : primaryColor
}

private func currentElapsedSeconds(for state: ToiletTimerAttributes.ContentState) -> Double {
  if state.isPaused {
    return state.accumulatedElapsedSeconds
  }

  return max(0, Date().timeIntervalSince(state.timerStartDate))
}
