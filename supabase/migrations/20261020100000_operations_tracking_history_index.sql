BEGIN;
CREATE INDEX IF NOT EXISTS operations_tracking_history_idx
 ON operations_private.resources (tenant_id, (data->>'shipmentId'), (data->>'occurredAt') DESC, id DESC)
 WHERE kind='tracking';
COMMIT;
