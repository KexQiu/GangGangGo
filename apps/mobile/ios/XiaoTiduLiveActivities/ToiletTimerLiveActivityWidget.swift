import ActivityKit
import SwiftUI
import WidgetKit

private let appDeepLink = URL(string: "xiaotidu://toilet")
private let primaryColor = Color(red: 0.12, green: 0.63, blue: 0.43)
private let infoColor = Color(red: 0.24, green: 0.49, blue: 0.94)
private let warningColor = Color(red: 0.89, green: 0.49, blue: 0.15)
private let dangerColor = Color(red: 0.85, green: 0.20, blue: 0.26)
private let inkColor = Color(red: 0.09, green: 0.12, blue: 0.13)
private let quietColor = Color(red: 0.38, green: 0.45, blue: 0.45)

private struct ToiletMilestone: Hashable {
  let seconds: Double
  let label: String
}

private let toiletMilestones = [
  ToiletMilestone(seconds: 5 * 60, label: "5"),
  ToiletMilestone(seconds: 10 * 60, label: "10"),
  ToiletMilestone(seconds: 15 * 60, label: "15"),
  ToiletMilestone(seconds: 20 * 60, label: "20")
]

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
        DynamicIslandExpandedRegion(.center) {
          IslandSummaryView(state: context.state)
        }

        DynamicIslandExpandedRegion(.bottom) {
          IslandBottomView(state: context.state)
        }
      } compactLeading: {
        CompactStageView(state: context.state)
          .accessibilityLabel(compactAccessibilityLabel(for: context.state))
      } compactTrailing: {
        CompactTimerView(state: context.state)
      } minimal: {
        FlowerBadgeView(state: context.state, size: 22, isCompact: true)
          .accessibilityLabel(compactAccessibilityLabel(for: context.state))
      }
      .widgetURL(appDeepLink)
      .keylineTint(toiletAccentColor(for: context.state))
    }
  }
}

private struct CompactStageView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    let compactText = compactStageText(for: state)

    HStack(spacing: 2) {
      FlowerBadgeView(state: state, size: 18, isCompact: true)

      if !compactText.isEmpty {
        Text(compactText)
          .font(.caption2.weight(.bold))
          .foregroundStyle(toiletAccentColor(for: state))
          .lineLimit(1)
          .minimumScaleFactor(0.68)
      }
    }
    .frame(width: compactText.isEmpty ? 20 : 56, alignment: .leading)
  }
}

private struct CompactTimerView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    elapsedText(for: state)
      .font(.caption2.monospacedDigit().weight(.semibold))
      .foregroundStyle(toiletAccentColor(for: state))
      .lineLimit(1)
      .minimumScaleFactor(0.72)
      .frame(width: 43, alignment: .trailing)
  }
}

private struct LockScreenLiveActivityView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    let accent = toiletAccentColor(for: state)
    let titleText = displayedTitle(for: state)
    let messageText = displayedMessage(for: state)
    let cue = cueText(for: state)

    VStack(alignment: .leading, spacing: 14) {
      HStack(alignment: .center, spacing: 12) {
        FlowerBadgeView(state: state, size: 50)

        VStack(alignment: .leading, spacing: 5) {
          HStack(spacing: 7) {
            Text("蹲会儿计时")
              .font(.caption.weight(.bold))
              .foregroundStyle(quietColor)
            StagePillView(state: state)
          }

          if !titleText.isEmpty {
            Text(titleText)
              .font(.headline.weight(.heavy))
              .foregroundStyle(inkColor)
              .lineLimit(1)
              .minimumScaleFactor(0.82)
          }

          if !messageText.isEmpty && messageText != titleText {
            Text(messageText)
              .font(.caption.weight(.medium))
              .foregroundStyle(quietColor)
              .lineLimit(2)
              .minimumScaleFactor(0.82)
          }
        }

        Spacer(minLength: 10)

        VStack(alignment: .trailing, spacing: 4) {
          elapsedText(for: state)
            .font(.title2.monospacedDigit().weight(.heavy))
            .foregroundStyle(accent)
            .lineLimit(1)
            .minimumScaleFactor(0.76)

          if !cue.isEmpty {
            Text(cue)
              .font(.caption2.weight(.semibold))
              .foregroundStyle(accent)
              .lineLimit(1)
              .minimumScaleFactor(0.75)
          }
        }
      }
    }
    .padding(16)
  }
}

private struct IslandSummaryView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    let titleText = displayedTitle(for: state)
    let cue = cueText(for: state)

    HStack(alignment: .center, spacing: 8) {
      FlowerBadgeView(state: state, size: 28)

      VStack(alignment: .leading, spacing: 2) {
        if !titleText.isEmpty {
          Text(titleText)
            .font(.subheadline.weight(.heavy))
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.78)
        }

        if !cue.isEmpty && cue != titleText {
          Text(cue)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.white.opacity(0.64))
            .lineLimit(1)
            .minimumScaleFactor(0.78)
        }
      }

      elapsedText(for: state)
        .font(.subheadline.monospacedDigit().weight(.heavy))
        .foregroundStyle(toiletAccentColor(for: state))
        .lineLimit(1)
        .minimumScaleFactor(0.74)
    }
    .frame(width: 212, alignment: .center)
    .padding(.vertical, 1)
  }
}

private struct IslandStatusView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    let titleText = displayedTitle(for: state)

    HStack(spacing: 8) {
      FlowerBadgeView(state: state, size: 32)

      VStack(alignment: .leading, spacing: 2) {
        Text("蹲会儿计时")
          .font(.caption2.weight(.semibold))
          .foregroundStyle(.white.opacity(0.66))
        if !titleText.isEmpty {
          Text(titleText)
            .font(.headline.weight(.heavy))
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.72)
        }
      }
    }
  }
}

private struct IslandTimerView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    let cue = cueText(for: state)

    VStack(alignment: .trailing, spacing: 3) {
      elapsedText(for: state)
        .font(.title3.monospacedDigit().weight(.heavy))
        .foregroundStyle(toiletAccentColor(for: state))
        .lineLimit(1)
        .minimumScaleFactor(0.74)

      if !cue.isEmpty {
        Text(cue)
          .font(.caption2.weight(.semibold))
          .foregroundStyle(.white.opacity(0.62))
          .lineLimit(1)
          .minimumScaleFactor(0.72)
      }
    }
  }
}

private struct IslandBottomView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    let messageText = displayedMessage(for: state)

    if !messageText.isEmpty {
      Text(messageText)
        .font(.caption.weight(.medium))
        .foregroundStyle(.white.opacity(0.80))
        .lineLimit(1)
        .minimumScaleFactor(0.78)
        .multilineTextAlignment(.center)
        .padding(.top, 2)
        .frame(width: 212, alignment: .center)
    }
  }
}

private struct FlowerBadgeView: View {
  let state: ToiletTimerAttributes.ContentState
  let size: CGFloat
  var isCompact = false

  var body: some View {
    let accent = toiletAccentColor(for: state)
    let petalSize = size * 0.34
    let petalDistance = size * 0.22

    ZStack {
      Circle()
        .fill(accent.opacity(isCompact ? 0.12 : 0.16))
        .frame(width: size, height: size)

      ForEach(0..<6, id: \.self) { index in
        let angle = (Double(index) / 6.0) * Double.pi * 2.0

        Circle()
          .fill(accent.opacity(state.isPaused ? 0.36 : 0.58))
          .frame(width: petalSize, height: petalSize)
          .offset(
            x: CGFloat(cos(angle)) * petalDistance,
            y: CGFloat(sin(angle)) * petalDistance
          )
      }

      Circle()
        .fill(accent)
        .frame(width: size * 0.32, height: size * 0.32)

      if state.isPaused {
        Image(systemName: "pause.fill")
          .font(.system(size: max(size * 0.20, 7), weight: .heavy))
          .foregroundStyle(.white)
      } else if currentStageKey(for: state) == "severe_warning" {
        Text("!")
          .font(.system(size: max(size * 0.24, 8), weight: .heavy))
          .foregroundStyle(.white)
      }
    }
    .frame(width: size, height: size)
  }
}

private struct StagePillView: View {
  let state: ToiletTimerAttributes.ContentState

  var body: some View {
    let pillText = stagePillText(for: state)

    if !pillText.isEmpty {
      Text(pillText)
        .font(.caption2.weight(.bold))
        .foregroundStyle(toiletAccentColor(for: state))
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(
          Capsule()
            .fill(toiletAccentColor(for: state).opacity(0.13))
        )
        .lineLimit(1)
    }
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

private func displayedTitle(for state: ToiletTimerAttributes.ContentState) -> String {
  if state.isPaused {
    return ""
  }

  return fallbackStageTitle(for: currentStageKey(for: state))
}

private func displayedMessage(for state: ToiletTimerAttributes.ContentState) -> String {
  if state.isPaused {
    return ""
  }

  return fallbackStageMessage(for: currentStageKey(for: state))
}

private func stagePillText(for state: ToiletTimerAttributes.ContentState) -> String {
  if state.isPaused {
    return ""
  }

  switch currentStageKey(for: state) {
  case "severe_warning":
    return "过劳中"
  case "overtime":
    return "过劳中"
  case "strong_warning":
    return "加班中"
  case "gentle_warning":
    return "值班中"
  default:
    return "值班中"
  }
}

private func compactStageText(for state: ToiletTimerAttributes.ContentState) -> String {
  if state.isPaused {
    return ""
  }

  switch currentStageKey(for: state) {
  case "severe_warning":
    return "过劳中"
  case "overtime":
    return "过劳中"
  case "strong_warning":
    return "加班中"
  case "gentle_warning":
    return "值班中"
  default:
    return "值班中"
  }
}

private func cueText(for state: ToiletTimerAttributes.ContentState) -> String {
  if state.isPaused {
    return ""
  }

  return fallbackStageMessage(for: currentStageKey(for: state))
}

private func compactAccessibilityLabel(for state: ToiletTimerAttributes.ContentState) -> String {
  if state.isPaused {
    return "蹲会儿暂停中"
  }

  return "蹲会儿\(displayedTitle(for: state))"
}

private func formatCueSeconds(_ seconds: Double) -> String {
  let totalSeconds = max(0, Int(seconds.rounded()))
  let minutes = totalSeconds / 60
  let remainingSeconds = totalSeconds % 60

  return String(format: "%02d:%02d", minutes, remainingSeconds)
}

private func nextCueSeconds(for state: ToiletTimerAttributes.ContentState) -> Double {
  let elapsedSeconds = currentElapsedSeconds(for: state)

  if let nextCueSeconds = state.nextCueSeconds,
     nextCueSeconds > elapsedSeconds,
     nextCueSeconds <= targetSeconds(for: state) {
    return nextCueSeconds
  }

  return toiletMilestones.first { $0.seconds > elapsedSeconds }?.seconds ?? targetSeconds(for: state)
}

private func targetSeconds(for state: ToiletTimerAttributes.ContentState) -> Double {
  guard let targetSeconds = state.targetSeconds, targetSeconds > 0 else {
    return 20 * 60
  }

  return targetSeconds
}

private func snapshotMatchesCurrentStage(_ state: ToiletTimerAttributes.ContentState) -> Bool {
  guard let stageKey = nonEmpty(state.stageKey) else {
    return false
  }

  return stageKey == currentStageKey(for: state)
}

private func currentStageKey(for state: ToiletTimerAttributes.ContentState) -> String {
  stageKey(for: currentElapsedSeconds(for: state))
}

private func stageKey(for elapsedSeconds: Double) -> String {
  if elapsedSeconds >= 20 * 60 {
    return "severe_warning"
  }
  if elapsedSeconds >= 15 * 60 {
    return "overtime"
  }
  if elapsedSeconds >= 10 * 60 {
    return "strong_warning"
  }
  if elapsedSeconds >= 5 * 60 {
    return "gentle_warning"
  }

  return "normal"
}

private func fallbackStageTitle(for stageKey: String) -> String {
  switch stageKey {
  case "severe_warning":
    return "小花过劳了"
  case "overtime":
    return "小花过劳了"
  case "strong_warning":
    return "别再加班了"
  case "gentle_warning":
    return "小花该下班了"
  default:
    return "小花值班中"
  }
}

private func fallbackStageMessage(for stageKey: String) -> String {
  switch stageKey {
  case "severe_warning":
    return "小花过劳了"
  case "overtime":
    return "小花过劳了"
  case "strong_warning":
    return "别再加班了"
  case "gentle_warning":
    return "小花该下班了"
  default:
    return "小花值班中"
  }
}

private func toiletAccentColor(for state: ToiletTimerAttributes.ContentState) -> Color {
  if state.isPaused {
    return warningColor
  }

  switch currentStageKey(for: state) {
  case "severe_warning":
    return dangerColor
  case "overtime", "strong_warning":
    return warningColor
  case "gentle_warning":
    return infoColor
  default:
    return primaryColor
  }
}

private func backgroundColor(for state: ToiletTimerAttributes.ContentState) -> Color {
  if state.isPaused {
    return Color(red: 1.00, green: 0.97, blue: 0.91)
  }

  switch currentStageKey(for: state) {
  case "severe_warning":
    return Color(red: 1.00, green: 0.94, blue: 0.94)
  case "overtime", "strong_warning":
    return Color(red: 1.00, green: 0.96, blue: 0.88)
  case "gentle_warning":
    return Color(red: 0.94, green: 0.97, blue: 1.00)
  default:
    return Color(red: 0.94, green: 0.99, blue: 0.96)
  }
}

private func currentElapsedSeconds(for state: ToiletTimerAttributes.ContentState) -> Double {
  if state.isPaused {
    return state.accumulatedElapsedSeconds
  }

  return max(0, Date().timeIntervalSince(state.timerStartDate))
}

private func nonEmpty(_ value: String?) -> String? {
  guard let value else {
    return nil
  }

  let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
  return trimmedValue.isEmpty ? nil : trimmedValue
}
