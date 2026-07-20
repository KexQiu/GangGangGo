import ExpoModulesCore
import Foundation

public final class GangGangGoStorageProtectionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GangGangGoStorageProtection")

    AsyncFunction("protectSQLiteFiles") { (directory: String, databaseName: String) in
      let directoryURL = normalizedFileURL(directory)
      let databaseURL = directoryURL.appendingPathComponent(databaseName)
      let urls = [
        directoryURL,
        databaseURL,
        URL(fileURLWithPath: databaseURL.path + "-wal"),
        URL(fileURLWithPath: databaseURL.path + "-shm"),
      ]

      for url in urls where FileManager.default.fileExists(atPath: url.path) {
        try applyProtection(to: url)
      }
    }
  }
}

private func normalizedFileURL(_ value: String) -> URL {
  if value.hasPrefix("file://"), let url = URL(string: value) {
    return url
  }
  return URL(fileURLWithPath: value, isDirectory: true)
}

private func applyProtection(to url: URL) throws {
  try FileManager.default.setAttributes(
    [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
    ofItemAtPath: url.path
  )
  var values = URLResourceValues()
  values.isExcludedFromBackup = true
  var mutableURL = url
  try mutableURL.setResourceValues(values)
}
