export const habitCheckInPageSql = `
  SELECT
    date,
    water,
    fiber,
    movement,
    bowel,
    updated_at
  FROM habit_checkins
  WHERE ($fromDate IS NULL OR date >= $fromDate)
    AND ($toDateExclusive IS NULL OR date < $toDateExclusive)
    AND ($cursorDate IS NULL OR date < $cursorDate)
  ORDER BY date DESC
  LIMIT $queryLimit;
`;

export const toiletSessionPageSql = `
  SELECT
    id,
    started_at,
    ended_at,
    duration_seconds,
    feeling,
    discomfort,
    bleeding
  FROM toilet_sessions
  WHERE ($fromDateTime IS NULL OR ended_at >= $fromDateTime)
    AND ($toDateTimeExclusive IS NULL OR ended_at < $toDateTimeExclusive)
    AND (
      $cursorEndedAt IS NULL
      OR ended_at < $cursorEndedAt
      OR (ended_at = $cursorEndedAt AND id < $cursorId)
    )
  ORDER BY ended_at DESC, id DESC
  LIMIT $queryLimit;
`;

export const trainingSessionPageSql = `
  SELECT
    id,
    preset_id,
    started_at,
    ended_at,
    duration_seconds,
    completed_repetitions,
    is_completed,
    discomfort_reported
  FROM training_sessions
  WHERE ($fromDateTime IS NULL OR ended_at >= $fromDateTime)
    AND ($toDateTimeExclusive IS NULL OR ended_at < $toDateTimeExclusive)
    AND (
      $cursorEndedAt IS NULL
      OR ended_at < $cursorEndedAt
      OR (ended_at = $cursorEndedAt AND id < $cursorId)
    )
  ORDER BY ended_at DESC, id DESC
  LIMIT $queryLimit;
`;
