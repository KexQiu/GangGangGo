export const habitCheckInPageSql = `
  SELECT
    date,
    water,
    fiber,
    movement,
    bowel,
    updated_at
  FROM habit_checkins
  WHERE profile_id = (SELECT value FROM app_metadata WHERE key = 'active_profile_id')
    AND deleted_at IS NULL
    AND ($fromDate IS NULL OR date >= $fromDate)
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
    bleeding,
    stool_shape,
    stool_color,
    signals_json
  FROM toilet_sessions
  WHERE profile_id = (SELECT value FROM app_metadata WHERE key = 'active_profile_id')
    AND deleted_at IS NULL
    AND ($fromDateTime IS NULL OR ended_at >= $fromDateTime)
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
  WHERE profile_id = (SELECT value FROM app_metadata WHERE key = 'active_profile_id')
    AND deleted_at IS NULL
    AND ($fromDateTime IS NULL OR ended_at >= $fromDateTime)
    AND ($toDateTimeExclusive IS NULL OR ended_at < $toDateTimeExclusive)
    AND (
      $cursorEndedAt IS NULL
      OR ended_at < $cursorEndedAt
      OR (ended_at = $cursorEndedAt AND id < $cursorId)
    )
  ORDER BY ended_at DESC, id DESC
  LIMIT $queryLimit;
`;
