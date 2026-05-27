import SwiftUI
import WidgetKit

private struct XiaoTiduComplicationEntry: TimelineEntry {
  let date: Date
}

private struct XiaoTiduComplicationProvider: TimelineProvider {
  func placeholder(in context: Context) -> XiaoTiduComplicationEntry {
    XiaoTiduComplicationEntry(date: Date())
  }

  func getSnapshot(in context: Context, completion: @escaping (XiaoTiduComplicationEntry) -> Void) {
    completion(XiaoTiduComplicationEntry(date: Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<XiaoTiduComplicationEntry>) -> Void) {
    let entry = XiaoTiduComplicationEntry(date: Date())
    let nextRefresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
    completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
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
      Text("小提督 今日")
    default:
      rectangularView
    }
  }

  private var circularView: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 1) {
        Image(systemName: "figure.mind.and.body")
          .font(.system(size: 18, weight: .semibold))
        Text("今日")
          .font(.system(size: 9, weight: .bold))
      }
    }
  }

  private var rectangularView: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text("小提督")
        .font(.headline)
      Text("打开手表同步今日状态")
        .font(.caption2)
        .foregroundStyle(.secondary)
    }
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
