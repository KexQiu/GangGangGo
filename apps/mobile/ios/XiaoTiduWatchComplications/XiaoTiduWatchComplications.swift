import SwiftUI
import WidgetKit

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
    let nextRefresh = Calendar.current.date(
      byAdding: .minute,
      value: entry.isStale ? 10 : 30,
      to: Date()
    ) ?? Date()
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
}

private struct XiaoTiduComplicationView: View {
  @Environment(\.widgetFamily) private var family
  let entry: XiaoTiduComplicationEntry

  var body: some View {
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

  private var circularView: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 1) {
        Image(systemName: entry.isStale ? "arrow.clockwise" : "checkmark.circle")
          .font(.system(size: 18, weight: .semibold))
        Text(circularText)
          .font(.system(size: 9, weight: .bold))
      }
    }
  }

  private var rectangularView: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text("小提督")
        .font(.headline)
      Text(rectangularDetail)
        .font(.caption2)
        .foregroundStyle(.secondary)
    }
  }

  private var circularText: String {
    guard !entry.isStale, let state = entry.state else {
      return "同步"
    }

    return "\(state.habits.completion)/4"
  }

  private var inlineText: String {
    guard !entry.isStale, let state = entry.state else {
      return "小提督 打开同步"
    }

    return "小提督 小账本 \(state.habits.completion)/4"
  }

  private var rectangularDetail: String {
    guard !entry.isStale, let state = entry.state else {
      return "打开手表同步今日状态"
    }

    let trainingText = state.training.done ? "菊花抬已完成" : "菊花抬 \(state.training.completedSets) 组"

    return "小账本 \(state.habits.completion)/4 · \(trainingText)"
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
