// Server-side audit helper. Records one activity_log row with full before/after
// row snapshots. Intended to be called from mutation routes after the write
// succeeds, so a failed mutation never produces a log entry.

export async function logAction(admin, {
  hotelId,
  userId,
  action,
  entityType,
  entityId,
  before,
  after,
  req,
} = {}) {
  return admin.from('activity_logs').insert({
    hotel_id: hotelId || null,
    user_id: userId || null,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    before: before ? JSON.parse(JSON.stringify(before)) : null,
    after: after ? JSON.parse(JSON.stringify(after)) : null,
    ip: req && (req.headers['x-forwarded-for'] || req.socket?.remoteAddress),
    user_agent: req && req.headers['user-agent'],
  })
}
