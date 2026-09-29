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
    guard CommandLine.arguments.count == 3 else {
      throw ValidationError("expected state and training event fixture paths")
    }

    let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
    let state = try JSONDecoder().decode(WatchTodayState.self, from: data)
    guard state.schemaVersion == 6 else {
      throw ValidationError("expected schemaVersion 6")
    }
    guard state.habits.completion >= 0, state.habits.completion <= 4 else {
      throw ValidationError("habit completion is outside 0...4")
    }
    guard !state.trainingModes.isEmpty else {
      throw ValidationError("trainingModes must not be empty")
    }

    let eventData = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2]))
    let envelope = try JSONSerialization.jsonObject(with: eventData) as! [String: Any]
    let event = envelope["event"] as! [String: Any]
    let payload = event["payload"] as! [String: Any]
    let recordData = try JSONSerialization.data(withJSONObject: payload["session"]!)
    let record = try JSONDecoder().decode(WatchTrainingRecord.self, from: recordData)
    guard event["schemaVersion"] as? Int == 4, record.id == event["id"] as? String,
      record.completedRepetitions == 2, record.plan.repetitions == 4, !record.isCompleted,
      record.feedback == "reported", record.endReason == "discomfort"
    else {
      throw ValidationError("training fixture does not preserve partial completion and feedback")
    }

    let json = try JSONSerialization.jsonObject(with: data)
    let leakedKeys = findForbiddenKeys(json)
    guard leakedKeys.isEmpty else {
      throw ValidationError(
        "fixture exposes private keys: \(leakedKeys.sorted().joined(separator: ", "))")
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
