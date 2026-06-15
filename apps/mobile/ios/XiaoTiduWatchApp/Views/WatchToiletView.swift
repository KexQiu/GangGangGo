import Foundation
import SwiftUI
import WatchKit

struct WatchToiletView: View {
  @EnvironmentObject private var session: WatchSessionManager
  @State private var lastNotifiedStage: WatchToiletStage?
  @State private var now = Date()
  @State private var showingFinishConfirmation = false

  private let tick = Timer.publish(every: 0.25, on: .main, in: .common).autoconnect()

  var body: some View {
    ScrollView(.vertical) {
      Group {
        if !session.todayState.isPro {
          VStack(spacing: 10) {
            Text("蹲会儿")
              .font(.headline)

            Text("\(session.todayState.toilet.sessionCount) 次")
              .font(.system(size: 38, weight: .bold, design: .rounded))
              .monospacedDigit()

            Text(session.todayState.proLockedBody)
              .font(.caption)
              .foregroundStyle(.secondary)
              .multilineTextAlignment(.center)
          }
        } else {
          VStack(spacing: 8) {

            if let stage = session.todayState.currentToiletStage(now: now) {
              Text(stage.title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(stageColor(stage))
            }

            Text(timeText)
              .font(.system(size: 38, weight: .bold, design: .rounded))
              .monospacedDigit()

            Text(statusText)
              .font(.caption2)
              .multilineTextAlignment(.center)
              .foregroundStyle(.secondary)

            if session.todayState.toilet.isRunning {
              Button(session.todayState.toilet.isPaused ? "继续" : "暂停") {
                WKInterfaceDevice.current().play(.click)
                session.sendToiletAction(
                  session.todayState.toilet.isPaused ? "resume" : "pause",
                  elapsedSeconds: elapsedSeconds
                )
              }
              .controlSize(.small)

              Button("收工") {
                showingFinishConfirmation = true
              }
              .buttonStyle(.borderedProminent)
              .controlSize(.small)
            } else {
              Text("需要从 iPhone 开始计时。")
                .font(.caption)
                .foregroundStyle(.secondary)
            }
          }
        }
      }
      .frame(maxWidth: .infinity)
      .padding(.horizontal)
      .padding(.vertical, 8)
    }
    .navigationTitle("蹲会儿")
    .confirmationDialog("确认收工？", isPresented: $showingFinishConfirmation, titleVisibility: .visible) {
      Button("收工并同步", role: .destructive) {
        WKInterfaceDevice.current().play(.success)
        session.sendToiletAction("finish", elapsedSeconds: elapsedSeconds)
      }
      Button("再等等", role: .cancel) {}
    } message: {
      Text("会把当前蹲会儿记录发给 iPhone。")
    }
    .onReceive(tick) { date in
      now = date
      notifyStageIfNeeded()
    }
    .onChange(of: session.todayState.toilet.isRunning) { _, isRunning in
      if !isRunning {
        lastNotifiedStage = nil
      }
    }
  }

  private var elapsedSeconds: Int {
    session.todayState.currentToiletElapsedSeconds(now: now)
  }

  private var statusText: String {
    guard session.todayState.toilet.isRunning else {
      return "当前没有进行中的蹲会儿。"
    }

    if session.todayState.toilet.isPaused {
      return "已暂停，需要继续时轻点一下。"
    }

    switch session.todayState.currentToiletStage(now: now) {
    case .gentleWarning:
      return "正事办完就撤。"
    case .strongWarning:
      return "差不多该收工了，别让局部压力加班。"
    case .overtime:
      return "这趟有点长，手机小剧场下次再播。"
    case .severeWarning:
      return "给小花一点下班时间。"
    case .normal, .none:
      return "办正事中，手机先别开小剧场。"
    }
  }

  private var timeText: String {
    guard session.todayState.toilet.isRunning else {
      return "0:00"
    }

    let minutes = elapsedSeconds / 60
    let seconds = elapsedSeconds % 60

    return "\(minutes):\(String(format: "%02d", seconds))"
  }

  private func notifyStageIfNeeded() {
    guard session.todayState.toilet.isRunning, !session.todayState.toilet.isPaused else {
      return
    }

    guard let stage = session.todayState.currentToiletStage(now: now), stage != .normal, stage != lastNotifiedStage else {
      return
    }

    lastNotifiedStage = stage

    switch stage {
    case .gentleWarning:
      WKInterfaceDevice.current().play(.click)
    case .strongWarning:
      WKInterfaceDevice.current().play(.notification)
    case .overtime:
      WKInterfaceDevice.current().play(.retry)
    case .severeWarning:
      WKInterfaceDevice.current().play(.failure)
    case .normal:
      break
    }
  }

  private func stageColor(_ stage: WatchToiletStage) -> Color {
    switch stage {
    case .normal:
      return .green
    case .gentleWarning:
      return .blue
    case .strongWarning:
      return .yellow
    case .overtime:
      return .orange
    case .severeWarning:
      return .red
    }
  }
}
