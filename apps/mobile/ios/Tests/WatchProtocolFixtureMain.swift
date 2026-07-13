import Foundation

@main
struct WatchProtocolFixtureMain {
  private static let forbiddenKeys: Set<String> = [
    "accessToken",
    "refreshToken",
    "durationSeconds",
    "endedAt",
    "note",
    "startedAt",
    "symptoms",
    "token",
  ]

  static func main() throws {
    guard CommandLine.arguments.count == 2 else {
      throw ValidationError("expected one fixture path")
    }

    let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
    let state = try JSONDecoder().decode(WatchTodayState.self, from: data)
    guard state.schemaVersion == 2 else {
      throw ValidationError("expected schemaVersion 2")
    }
    guard state.habits.completion >= 0, state.habits.completion <= 4 else {
      throw ValidationError("habit completion is outside 0...4")
    }
    guard !state.trainingModes.isEmpty else {
      throw ValidationError("trainingModes must not be empty")
    }

    let json = try JSONSerialization.jsonObject(with: data)
    let leakedKeys = findForbiddenKeys(json)
    guard leakedKeys.isEmpty else {
      throw ValidationError("fixture exposes private keys: \(leakedKeys.sorted().joined(separator: ", "))")
    }
  }

  private static func findForbiddenKeys(_ value: Any) -> Set<String> {
    if let array = value as? [Any] {
      return array.reduce(into: []) { result, item in
        result.formUnion(findForbiddenKeys(item))
      }
    }
    guard let object = value as? [String: Any] else {
      return []
    }

    return object.reduce(into: []) { result, entry in
      if forbiddenKeys.contains(entry.key) {
        result.insert(entry.key)
      }
      result.formUnion(findForbiddenKeys(entry.value))
    }
  }
}

private struct ValidationError: LocalizedError {
  let errorDescription: String?

  init(_ description: String) {
    errorDescription = description
  }
}
