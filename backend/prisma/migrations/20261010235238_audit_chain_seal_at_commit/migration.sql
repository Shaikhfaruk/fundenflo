CREATE OR REPLACE FUNCTION audit_events_chain() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.prev_hash := NULL;
  NEW.hash := NULL;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION audit_events_seal() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  previous text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('audit_events_chain'));
  SELECT hash INTO previous FROM audit_events WHERE hash IS NOT NULL ORDER BY seq DESC LIMIT 1;
  UPDATE audit_events
     SET seq = nextval(pg_get_serial_sequence('audit_events', 'seq')),
         prev_hash = previous,
         hash = audit_event_hash(previous, id, occurred_at, actor_type::text, actor_user_id, action, entity_type, entity_id, metadata)
   WHERE id = NEW.id;
  RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION audit_events_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND pg_trigger_depth() > 1
     AND OLD.hash IS NULL
     AND NEW.hash IS NOT NULL
     AND (to_jsonb(NEW) - ARRAY['seq', 'prev_hash', 'hash']) IS NOT DISTINCT FROM (to_jsonb(OLD) - ARRAY['seq', 'prev_hash', 'hash']) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END
$$;

DROP TRIGGER audit_events_append_only ON audit_events;

CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();

CREATE CONSTRAINT TRIGGER audit_events_seal
  AFTER INSERT ON audit_events
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION audit_events_seal();
