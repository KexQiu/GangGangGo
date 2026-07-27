import SwiftUI
import WidgetKit

private enum XiaoTiduWatchDeepLink {
  static let home = URL(string: "xiaotidu-watch://home")
  static let toilet = URL(string: "xiaotidu-watch://toilet")
}

private struct XiaoTiduComplicationEntry: TimelineEntry {
  let date: Date
  let isStale: Bool
  let state: WatchTodayState?
}

private struct XiaoTiduComplicationProvider: TimelineProvider {
  func placeholder(in context: Context) -> XiaoTiduComplicationEntry {
    XiaoTiduComplicationEntry(date: Date(), isStale: true, state: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (XiaoTiduComplicationEntry) -> Void) {
    completion(makeEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<XiaoTiduComplicationEntry>) -> Void) {
    let entry = makeEntry()
    let nextRefresh = nextRefreshDate(for: entry)
    completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
  }

  private func makeEntry() -> XiaoTiduComplicationEntry {
    let state = WatchSharedStateStore.load()

    return XiaoTiduComplicationEntry(
      date: Date(),
      isStale: state.map { WatchSharedStateStore.isStale($0) } ?? true,
      state: state
    )
  }

  private func nextRefreshDate(for entry: XiaoTiduComplicationEntry) -> Date {
    let minuteOffset: Int

    if entry.isStale {
      minuteOffset = 10
    } else if entry.state?.canUseActions == true && entry.state?.toilet.isRunning == true {
      minuteOffset = 1
    } else {
      minuteOffset = 30
    }

    return Calendar.current.date(byAdding: .minute, value: minuteOffset, to: Date()) ?? Date()
  }
}

private struct XiaoTiduComplicationView: View {
  @Environment(\.widgetFamily) private var family
  let entry: XiaoTiduComplicationEntry

  var body: some View {
    Group {
      switch family {
      case .accessoryCircular:
        circularView
      case .accessoryRectangular:
        rectangularView
      case .accessoryInline:
        Text(inlineText)
      default:
        rectangularView
      }
    }
    .widgetURL(widgetURL)
    .containerBackground(for: .widget) {
      Color.clear
    }
  }

  private var circularView: some View {
    ZStack {
      AccessoryWidgetBackground()
      Gauge(value: presentation.progress) {
        EmptyView()
      }
      .gaugeStyle(.accessoryCircularCapacity)
      .tint(presentation.accent)

      VStack(spacing: 0) {
        Image(systemName: presentation.iconName)
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(presentation.accent)

        Text(presentation.circularText)
          .font(.system(size: 9, weight: .bold, design: .rounded))
          .monospacedDigit()
          .minimumScaleFactor(0.7)
          .lineLimit(1)
      }
    }
  }

  private var rectangularView: some View {
    HStack(alignment: .center, spacing: 6) {
      ZStack {
        RoundedRectangle(cornerRadius: 5, style: .continuous)
          .fill(presentation.accent.opacity(0.18))

        Image(systemName: presentation.iconName)
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(presentation.accent)
      }
      .frame(width: 28, height: 28)

      VStack(alignment: .leading, spacing: 1) {
        Text(presentation.title)
          .font(.headline)
          .lineLimit(1)

        Text(presentation.detail)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)

        Text(presentation.footnote)
          .font(.caption2)
          .fontWeight(.semibold)
          .foregroundStyle(presentation.accent)
          .lineLimit(1)
      }
    }
  }

  private var presentation: XiaoTiduComplicationPresentation {
    XiaoTiduComplicationPresentation(entry: entry)
  }

  private var inlineText: String {
    presentation.inlineText
  }

  private var widgetURL: URL? {
    presentation.widgetURL
  }
}

private struct XiaoTiduComplicationPresentation {
  let accent: Color
  let circularText: String
  let detail: String
  let footnote: String
  let iconName: String
  let inlineText: String
  let progress: Double
  let title: String
  let widgetURL: URL?

  init(entry: XiaoTiduComplicationEntry) {
    guard !entry.isStale, let state = entry.state else {
      accent = .blue
      circularText = "同步"
      detail = "打开手表同步"
      footnote = "等待状态"
      iconName = "arrow.clockwise"
      inlineText = "小提督 打开同步"
      progress = 0.12
      title = "小提督"
      widgetURL = XiaoTiduWatchDeepLink.home
      return
    }

    guard state.canUseActions else {
      accent = .yellow
      circularText = state.account.isLoggedIn ? "同步" : "登录"
      detail = state.account.isLoggedIn ? "手表操作暂不可用" : "先登录小提督"
      footnote = state.account.isLoggedIn ? "请在 iPhone 刷新" : "打开 iPhone 登录"
      iconName = "lock.fill"
      inlineText = state.account.isLoggedIn ? "小提督 手表暂不可用" : "小提督 请先登录"
      progress = 0
      title = "小提督"
      widgetURL = nil
      return
    }

    if state.toilet.isRunning {
      let elapsedMinutes = state.currentToiletElapsedSeconds(now: entry.date) / 60
      let minuteText = elapsedMinutes > 0 ? "\(elapsedMinutes) 分" : "刚开始"
      let stateText = state.toilet.isPaused ? "已暂停" : "进行中"

      accent = state.toilet.isPaused ? .yellow : .orange
      circularText = elapsedMinutes > 0 ? "\(elapsedMinutes)m" : "计时"
      detail = "\(minuteText) · \(stateText)"
      footnote = "点按继续处理"
      iconName = state.toilet.isPaused ? "pause.fill" : "timer"
      inlineText = "小提督 蹲会儿 \(stateText)"
      progress = min(Double(state.currentToiletElapsedSeconds(now: entry.date)) / Double(20 * 60), 1)
      title = "蹲会儿"
      widgetURL = XiaoTiduWatchDeepLink.toilet
      return
    }

    let completion = max(0, min(state.habits.completion, 4))
    let trainingText = state.training.done ? "菊花抬完成" : "菊花抬 \(state.training.completedSets) 组"

    accent = completion >= 4 ? .green : .mint
    circularText = "\(completion)/4"
    detail = "小账本 \(completion)/4"
    footnote = trainingText
    iconName = completion >= 4 ? "checkmark.circle.fill" : "leaf.fill"
    inlineText = "小提督 小账本 \(completion)/4"
    progress = Double(completion) / 4
    title = "今日状态"
    widgetURL = XiaoTiduWatchDeepLink.home
  }
}

private struct XiaoTiduTodayComplication: Widget {
  let kind = "xiaotidu_today_complication"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: XiaoTiduComplicationProvider()) { entry in
      XiaoTiduComplicationView(entry: entry)
    }
    .configurationDisplayName("小提督今日")
    .description("快速回到小提督手表联动。")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

@main
struct XiaoTiduWatchComplications: WidgetBundle {
  var body: some Widget {
    XiaoTiduTodayComplication()
  }
}
