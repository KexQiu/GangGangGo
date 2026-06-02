import ActivityKit
import SwiftUI
import WidgetKit

private let appDeepLink = URL(string: "xiaotidu://toilet")
private let primaryColor = Color(red: 0.12, green: 0.63, blue: 0.43)
private let warningColor = Color(red: 0.89, green: 0.49, blue: 0.15)
private let dangerColor = Color(red: 0.85, green: 0.20, blue: 0.26)
private let inkColor = Color(red: 0.09, green: 0.12, blue: 0.13)
private let quietColor = Color(red: 0.38, green: 0.45, blue: 0.45)

@main
struct XiaoTiduLiveActivitiesBundle: WidgetBundle {
  var body: some Widget {
    ToiletTimerLiveActivityWidget()
  }
}

struct ToiletTimerLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: ToiletTimerAttributes.self) { context in
      LockScreenLiveActivityView(state: context.state)
        .activityBackgroundTint(backgroundColor(for: context.state))
        .activitySystemActionForegroundColor(toiletAccentColor(for: context.state))
        .widgetURL(appDeepLink)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          IslandStatusView(state: context.state)
        }

        DynamicIslandExpandedRegion(.trailing) {
          IslandTimerView(state: context.state)
        }

        DynamicIslandExpandedRegion(.bottom) {
          IslandBottomView(state: context.state)
        }
      } compactLeading: {
        CompactBadgeView(state: context.state)
      } compactTrailing: {
        elapsedText(for: context.state)
          .font(.caption2.monospacedDigit().weight(.semibold))
          .foregroundStyle(toiletAccentColor(for: context.state))
      } minimal: {
        MinimalBadgeView(state: context.state)
      }
      .widgetURL(appDeepLink)
      .keylineTint(toiletAccentColor(for: context.state))
    }
  }
}

private struct LockScreenLiveActivityView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    let accent = toiletAccentColor(for: state)

    VStack(alignment: .leading, spacing: 14) {
      HStack(alignment: .center, spacing: 12) {
        LiveActivityBadge(state: state, size: 46)

        VStack(alignment: .leading, spacing: 4) {
          HStack(spacing: 6) {
            Text("蹲会儿")
              .font(.headline.weight(.semibold))
              .foregroundStyle(inkColor)
            StatePillView(state: state)
          }

          Text(statusText(for: state))
            .font(.caption.weight(.medium))
            .foregroundStyle(quietColor)
            .lineLimit(1)
            .minimumScaleFactor(0.82)
        }

        Spacer(minLength: 10)

        elapsedText(for: state)
          .font(.title2.monospacedDigit().weight(.heavy))
          .foregroundStyle(accent)
      }

      VStack(alignment: .leading, spacing: 8) {
        TimelineBarView(state: state)

        HStack {
          Text(stageLabel(for: state))
            .font(.caption2.weight(.semibold))
            .foregroundStyle(accent)
          Spacer(minLength: 8)
          Text(state.isPaused ? "回来继续" : "办完就撤")
            .font(.caption2.weight(.medium))
            .foregroundStyle(quietColor)
        }
      }
    }
    .padding(16)
  }
}

private struct IslandStatusView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    HStack(spacing: 9) {
      LiveActivityBadge(state: state, size: 32)

      VStack(alignment: .leading, spacing: 2) {
        Text("蹲会儿")
          .font(.caption.weight(.semibold))
          .foregroundStyle(.white.opacity(0.72))
        Text(state.isPaused ? "暂停中" : stageLabel(for: state))
          .font(.headline.weight(.bold))
          .foregroundStyle(.white)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      }
    }
  }
}

private struct IslandTimerView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    VStack(alignment: .trailing, spacing: 2) {
      elapsedText(for: state)
        .font(.title3.monospacedDigit().weight(.heavy))
        .foregroundStyle(toiletAccentColor(for: state))

      Text(state.isPaused ? "已暂停" : "计时中")
        .font(.caption2.weight(.semibold))
        .foregroundStyle(.white.opacity(0.62))
    }
  }
}

private struct IslandBottomView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      Text(statusText(for: state))
        .font(.caption.weight(.medium))
        .foregroundStyle(.white.opacity(0.78))
        .lineLimit(1)
        .minimumScaleFactor(0.8)

      StaticTimelineBarView(state: state, backgroundOpacity: 0.18)
    }
    .padding(.top, 2)
  }
}

private struct LiveActivityBadge: View {
  let state: ToiletTimerAttributes.ContentState
  let size: CGFloat

  var body: some View {
    let accent = toiletAccentColor(for: state)

    ZStack {
      Circle()
        .fill(accent.opacity(0.16))
      Circle()
        .strokeBorder(accent.opacity(0.28), lineWidth: 1)
      Image(systemName: state.isPaused ? "pause.fill" : "timer")
        .font(.system(size: size * 0.38, weight: .bold))
        .foregroundStyle(accent)
    }
    .frame(width: size, height: size)
  }
}

private struct CompactBadgeView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    Text(state.isPaused ? "Ⅱ" : "蹲")
      .font(.caption.weight(.bold))
      .foregroundStyle(toiletAccentColor(for: state))
      .frame(width: 18, height: 18)
      .accessibilityLabel(state.isPaused ? "蹲会儿暂停中" : "蹲会儿计时中")
  }
}

private struct MinimalBadgeView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    ZStack {
      Circle()
        .fill(toiletAccentColor(for: state).opacity(0.22))
      Text(state.isPaused ? "Ⅱ" : "蹲")
        .font(.caption2.weight(.heavy))
        .foregroundStyle(toiletAccentColor(for: state))
    }
    .frame(width: 22, height: 22)
  }
}

private struct StatePillView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    Text(state.isPaused ? "暂停" : stageLabel(for: state))
      .font(.caption2.weight(.bold))
      .foregroundStyle(toiletAccentColor(for: state))
      .padding(.horizontal, 7)
      .padding(.vertical, 3)
      .background(
        Capsule()
          .fill(toiletAccentColor(for: state).opacity(0.12))
      )
      .lineLimit(1)
  }
}

private struct TimelineBarView: View {
  let state: ToiletTimerAttributes.ContentState
  var backgroundOpacity = 0.12

  var body: some View {
    GeometryReader { proxy in
      let progress = min(currentElapsedSeconds(for: state) / (20 * 60), 1)
      let width = max(6, proxy.size.width * progress)

      ZStack(alignment: .leading) {
        Capsule()
          .fill(toiletAccentColor(for: state).opacity(backgroundOpacity))
        Capsule()
          .fill(
            LinearGradient(
              colors: [
                primaryColor,
                toiletAccentColor(for: state)
              ],
              startPoint: .leading,
              endPoint: .trailing
            )
          )
          .frame(width: width)
      }
    }
    .frame(height: 6)
  }
}

private struct StaticTimelineBarView: View {
  let state: ToiletTimerAttributes.ContentState
  var backgroundOpacity = 0.12

  var body: some View {
    let progress = min(currentElapsedSeconds(for: state) / (20 * 60), 1)

    ProgressView(value: progress)
      .progressViewStyle(.linear)
      .tint(toiletAccentColor(for: state))
      .background(toiletAccentColor(for: state).opacity(backgroundOpacity))
      .clipShape(Capsule())
      .frame(height: 5)
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

private func stageLabel(for state: ToiletTimerAttributes.ContentState) -> String {
  if state.isPaused {
    return "暂停中"
  }

  let elapsedSeconds = currentElapsedSeconds(for: state)
  if elapsedSeconds >= 20 * 60 {
    return "该收工"
  }
  if elapsedSeconds >= 15 * 60 {
    return "有点久"
  }
  if elapsedSeconds >= 10 * 60 {
    return "准备收"
  }
  if elapsedSeconds >= 5 * 60 {
    return "轻提醒"
  }

  return "刚开始"
}

private func statusText(for state: ToiletTimerAttributes.ContentState) -> String {
  if state.isPaused {
    return "暂停中，回来继续也行"
  }

  let elapsedSeconds = currentElapsedSeconds(for: state)
  if elapsedSeconds >= 20 * 60 {
    return "超过 20 分钟了，建议先收工"
  }
  if elapsedSeconds >= 15 * 60 {
    return "这会儿有点长了，办完就撤"
  }
  if elapsedSeconds >= 10 * 60 {
    return "差不多该收工了"
  }
  if elapsedSeconds >= 5 * 60 {
    return "小声敲门：正事办完就撤"
  }

  return "办完就收工，别让小花陪坐太久"
}

private func toiletAccentColor(for state: ToiletTimerAttributes.ContentState) -> Color {
  if state.isPaused {
    return warningColor
  }

  return currentElapsedSeconds(for: state) >= 20 * 60 ? dangerColor : primaryColor
}

private func backgroundColor(for state: ToiletTimerAttributes.ContentState) -> Color {
  if state.isPaused {
    return Color(red: 1.00, green: 0.97, blue: 0.91)
  }

  if currentElapsedSeconds(for: state) >= 20 * 60 {
    return Color(red: 1.00, green: 0.94, blue: 0.94)
  }

  return Color(red: 0.94, green: 0.99, blue: 0.96)
}

private func currentElapsedSeconds(for state: ToiletTimerAttributes.ContentState) -> Double {
  if state.isPaused {
    return state.accumulatedElapsedSeconds
  }

  return max(0, Date().timeIntervalSince(state.timerStartDate))
}
