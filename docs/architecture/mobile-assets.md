# 移动端图片资产审计

日期：2026-07-13

## 范围与结论

本次审计覆盖 `apps/mobile/assets` 与 `apps/mobile/ios` 中全部 22 个受版本控制 PNG。每个文件都由 Expo 配置、iOS asset catalog 或 Watch asset catalog 引用，没有发现可删除的未使用图片。

存在两组内容重复资源：

- `assets/icon.png` 与 `assets/adaptive-icon.png` 内容相同，但分别承担通用 App Icon 与 Android adaptive foreground 角色，保留独立路径，便于后续平台独立调整。
- `assets/splash-icon.png` 与 iOS `SplashScreenLegacy.imageset` 的 1x / 2x / 3x 文件内容相同。后三个文件是 Xcode asset catalog 的明确 scale 槽位，不改为跨目录链接。

本轮只调整 PNG 编码，不重绘、裁切、缩放或更换任何视觉内容。

## 语义与尺寸

| 资产 | 用途 | 校验结果 |
| --- | --- | --- |
| `assets/icon.png` | Expo 通用 App Icon | 1024 x 1024、RGB |
| `assets/adaptive-icon.png` | Android adaptive foreground | 1024 x 1024、RGB，背景色由 Expo 配置独立提供 |
| iOS `AppIcon.appiconset` | iPhone / iPad App Icon | universal 1024 x 1024、RGB，Xcode 成功生成各设备尺寸 |
| `assets/splash-icon.png` | Expo 启动图源文件 | 1024 x 1024、RGBA |
| Watch `AppIcon.appiconset` | 通知、设置、launcher、quick look、marketing | 48 x 48 至 1024 x 1024，文件像素尺寸与 `Contents.json` 的 size / scale 全部匹配 |

## 无损压缩

使用 Xcode 自带 `pngcrush` 对全部文件重新编码。只有输出更小时才替换源文件；每个文件压缩前后均通过 `sips` 解码为 TIFF 并比较哈希，22 个文件的解码像素全部一致。

- 压缩前：2,943,978 字节。
- 压缩后：2,333,017 字节。
- 减少：610,961 字节，约 20.8%。

## 构建回归

Android 在 `/tmp` 中使用当前 Expo 配置执行临时 prebuild，未向仓库写入 `android/`。生成的普通 launcher、adaptive foreground 与启动图经人工查看后，再执行完整 Debug 构建：

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew assembleDebug --no-daemon
```

结果：Gradle 8.14.3、Android SDK 36 下 `BUILD SUCCESSFUL`，生成 Debug APK。

Apple 平台使用独立 DerivedData 完成以下无签名 Simulator 构建：

```bash
xcodebuild -workspace apps/mobile/ios/app.xcworkspace -scheme app -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
xcodebuild -workspace apps/mobile/ios/app.xcworkspace -scheme XiaoTiduWatchApp -sdk watchsimulator -destination 'generic/platform=watchOS Simulator' CODE_SIGNING_ALLOWED=NO build
xcodebuild -workspace apps/mobile/ios/app.xcworkspace -scheme XiaoTiduWatchComplications -sdk watchsimulator -destination 'generic/platform=watchOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

三个 scheme 均构建成功。iOS asset catalog 正常生成 `Assets.car`、iPhone / iPad App Icon，Watch App 与 Complication 产物完整。构建和资源人工查看未发现颜色、透明度、留白或裁切变化。
