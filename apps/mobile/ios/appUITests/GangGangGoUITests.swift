import XCTest

final class GangGangGoUITests: XCTestCase {
  private let metroURL = "http://localhost:8081"

  override func setUpWithError() throws {
    continueAfterFailure = false
  }

  func testDevelopmentClientLoadsHomeScreen() {
    let app = launchApp()

    XCTAssertTrue(
      app.staticTexts["今天轻轻安排一下"].waitForExistence(timeout: 30),
      "The development client did not load the application home screen.\n\(app.debugDescription)"
    )
  }

  func testBottomTabsOpenAllPrimaryScreens() {
    let app = launchApp()
    waitForHome(in: app)

    tapWhenHittable(tabButton("tab-trends", in: app), in: app)
    XCTAssertTrue(app.staticTexts["今天到长期的节奏"].waitForExistence(timeout: 10))

    tapWhenHittable(tabButton("tab-team", in: app), in: app)
    XCTAssertTrue(app.staticTexts["监督搭子"].waitForExistence(timeout: 10))

    tapWhenHittable(tabButton("tab-me", in: app), in: app)
    XCTAssertTrue(app.staticTexts["我的"].waitForExistence(timeout: 10))
    XCTAssertTrue(app.buttons["设置"].waitForExistence(timeout: 10))

    tapWhenHittable(tabButton("tab-home", in: app), in: app)
    waitForHome(in: app)
  }

  func testHomeShowsToiletAndTrainingPriorityActions() {
    let app = launchApp()
    waitForHome(in: app)

    XCTAssertTrue(app.buttons["蹲会儿，开始计时"].waitForExistence(timeout: 10))
    XCTAssertTrue(
      app.buttons.matching(
        NSPredicate(format: "label BEGINSWITH %@", "菊花抬，今日")
      ).firstMatch.waitForExistence(timeout: 10)
    )
  }

  func testMockUsersCanJoinTeamWithoutLeakingAccountCache() {
    let app = launchApp()
    waitForHome(in: app)

    let waterCheckIn = app.buttons.matching(
      NSPredicate(format: "label BEGINSWITH %@", "饮水，")
    ).firstMatch
    XCTAssertTrue(waterCheckIn.waitForExistence(timeout: 10))
    let previousWaterState = waterCheckIn.label
    tapWhenHittable(waterCheckIn, in: app)
    waitForLabelChange(of: waterCheckIn, from: previousWaterState)
    let persistedWaterState = waterCheckIn.label
    for _ in 0..<6 {
      app.swipeDown()
    }

    tapWhenHittable(tabButton("tab-me", in: app), in: app)
    XCTAssertTrue(app.staticTexts["我的"].waitForExistence(timeout: 10))

    tapWhenHittable(app.buttons["A"], in: app)
    XCTAssertTrue(app.staticTexts["模拟搭子 A"].waitForExistence(timeout: 15))
    XCTAssertTrue(app.staticTexts["小提督 Pro"].waitForExistence(timeout: 10))

    tapWhenHittable(tabButton("tab-team", in: app), in: app)
    XCTAssertTrue(app.staticTexts["还没有监督搭子"].waitForExistence(timeout: 10))
    tapWhenHittable(app.buttons["创建小队"], in: app)
    XCTAssertTrue(app.staticTexts["小提督小队"].waitForExistence(timeout: 15))
    XCTAssertTrue(app.staticTexts["1/4"].waitForExistence(timeout: 10))

    tapWhenHittable(app.buttons["邀请搭子"].firstMatch, in: app)
    XCTAssertTrue(app.staticTexts["邀请卡已准备好"].waitForExistence(timeout: 15))

    let inviteLink = app.staticTexts.matching(
      NSPredicate(format: "label BEGINSWITH %@", "xiaotidu://team/join/")
    ).firstMatch
    XCTAssertTrue(inviteLink.waitForExistence(timeout: 10), app.debugDescription)
    let inviteURL = inviteLink.label
    XCTAssertTrue(inviteURL.hasPrefix("xiaotidu://team/join/"))

    tapWhenHittable(app.buttons["复制链接"], in: app)
    XCTAssertTrue(app.staticTexts["链接已复制，可以发给搭子了。"].waitForExistence(timeout: 5))

    app.buttons["返回"].tap()
    XCTAssertTrue(app.staticTexts["小提督小队"].waitForExistence(timeout: 10))
    tapWhenHittable(tabButton("tab-me", in: app), in: app)
    XCTAssertTrue(app.staticTexts["模拟搭子 A"].waitForExistence(timeout: 10))

    tapWhenHittable(app.buttons["B"], in: app)
    XCTAssertTrue(app.staticTexts["模拟搭子 B"].waitForExistence(timeout: 15))
    XCTAssertFalse(app.staticTexts["模拟搭子 A"].exists)

    openDeepLink(inviteURL, returningTo: app)
    XCTAssertTrue(app.staticTexts["确认加入小队"].waitForExistence(timeout: 15), app.debugDescription)
    tapWhenHittable(app.buttons["加入小队"], in: app)
    XCTAssertTrue(app.staticTexts["小提督小队"].waitForExistence(timeout: 15))
    XCTAssertTrue(app.staticTexts["2/4"].waitForExistence(timeout: 10))

    app.terminate()
    let relaunchedApp = launchApp()
    waitForHome(in: relaunchedApp)
    let restoredWaterCheckIn = relaunchedApp.buttons.matching(
      NSPredicate(format: "label BEGINSWITH %@", "饮水，")
    ).firstMatch
    XCTAssertTrue(restoredWaterCheckIn.waitForExistence(timeout: 10))
    XCTAssertEqual(restoredWaterCheckIn.label, persistedWaterState)
    tapWhenHittable(tabButton("tab-me", in: relaunchedApp), in: relaunchedApp)
    XCTAssertTrue(relaunchedApp.staticTexts["模拟搭子 B"].waitForExistence(timeout: 10))

    tapWhenHittable(relaunchedApp.buttons["A"], in: relaunchedApp)
    XCTAssertTrue(relaunchedApp.staticTexts["模拟搭子 A"].waitForExistence(timeout: 15))
    XCTAssertFalse(relaunchedApp.staticTexts["模拟搭子 B"].exists)
    tapWhenHittable(tabButton("tab-team", in: relaunchedApp), in: relaunchedApp)
    XCTAssertTrue(relaunchedApp.staticTexts["2/4"].waitForExistence(timeout: 15))
    let buddyCard = relaunchedApp.buttons.matching(
      NSPredicate(format: "label BEGINSWITH %@", "模拟搭子 B，")
    ).firstMatch
    XCTAssertTrue(buddyCard.waitForExistence(timeout: 10), relaunchedApp.debugDescription)
  }

  private func launchApp() -> XCUIApplication {
    let app = XCUIApplication()
    app.launchArguments = ["--initialUrl", metroURL]
    app.launch()
    return app
  }

  private func waitForHome(in app: XCUIApplication) {
    XCTAssertTrue(
      app.staticTexts["今天轻轻安排一下"].waitForExistence(timeout: 30),
      app.debugDescription
    )
  }

  private func tabButton(_ identifier: String, in app: XCUIApplication) -> XCUIElement {
    app.buttons[identifier]
  }

  private func waitForLabelChange(
    of element: XCUIElement,
    from previousLabel: String,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    for _ in 0..<20 {
      if element.label != previousLabel {
        return
      }
      Thread.sleep(forTimeInterval: 0.25)
    }

    XCTFail("Element label did not change from \(previousLabel).", file: file, line: line)
  }

  private func tapWhenHittable(
    _ element: XCUIElement,
    in app: XCUIApplication,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    XCTAssertTrue(element.waitForExistence(timeout: 10), file: file, line: line)

    for _ in 0..<6 where !element.isHittable {
      app.swipeUp()
    }

    XCTAssertTrue(element.isHittable, element.debugDescription, file: file, line: line)
    element.tap()
  }

  private func openDeepLink(_ url: String, returningTo app: XCUIApplication) {
    let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
    safari.launch()

    let addressField = safari.textFields.firstMatch
    XCTAssertTrue(addressField.waitForExistence(timeout: 10), safari.debugDescription)
    addressField.tap()
    addressField.typeText(url)
    addressField.typeText("\n")

    let localizedOpenButton = safari.buttons["打开"]
    let englishOpenButton = safari.buttons["Open"]
    let openButton = localizedOpenButton.waitForExistence(timeout: 10) ? localizedOpenButton : englishOpenButton
    XCTAssertTrue(openButton.waitForExistence(timeout: 3), safari.debugDescription)
    openButton.tap()

    if !app.wait(for: .runningForeground, timeout: 3) {
      let confirmationOpenButton = safari.buttons["打开"]
      let confirmationOpenButtonEnglish = safari.buttons["Open"]
      let confirmationButton = confirmationOpenButton.waitForExistence(timeout: 3)
        ? confirmationOpenButton
        : confirmationOpenButtonEnglish

      XCTAssertTrue(confirmationButton.waitForExistence(timeout: 3), safari.debugDescription)
      confirmationButton.tap()
    }

    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 15))
  }
}
