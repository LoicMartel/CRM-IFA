-- Add gcal_event_ids to meetings so we can update/delete Google Calendar
-- events when a meeting is rescheduled or cancelled.
-- Key = manager first_name, value = GCal eventId (same pattern as training_sessions).
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS gcal_event_ids jsonb DEFAULT '{}';
