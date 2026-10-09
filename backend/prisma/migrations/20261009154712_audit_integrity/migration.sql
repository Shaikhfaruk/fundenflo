CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END
$$;

CREATE OR REPLACE FUNCTION audit_event_hash(
  prev_hash text,
  event_id uuid,
  occurred_at timestamptz,
  actor_type text,
  actor_user_id uuid,
  action text,
  entity_type text,
  entity_id text,
  metadata jsonb
) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(
    sha256(
      convert_to(
        concat_ws(
          '|',
          coalesce(prev_hash, ''),
          event_id::text,
          (extract(epoch FROM occurred_at) * 1000)::bigint::text,
          actor_type,
          coalesce(actor_user_id::text, ''),
          action,
          entity_type,
          coalesce(entity_id, ''),
          coalesce(metadata::text, '')
        ),
        'UTF8'
      )
    ),
    'hex'
  )
$$;

CREATE OR REPLACE FUNCTION audit_events_chain() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  previous text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('audit_events_chain'));
  NEW.seq := nextval(pg_get_serial_sequence('audit_events', 'seq'));
  SELECT hash INTO previous FROM audit_events ORDER BY seq DESC LIMIT 1;
  NEW.prev_hash := previous;
  NEW.hash := audit_event_hash(previous, NEW.id, NEW.occurred_at, NEW.actor_type::text, NEW.actor_user_id, NEW.action, NEW.entity_type, NEW.entity_id, NEW.metadata);
  RETURN NEW;
END
$$;

CREATE TRIGGER audit_events_chain
  BEFORE INSERT ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_chain();

CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

DROP INDEX "memberships_user_id_organization_id_role_key";
CREATE UNIQUE INDEX "memberships_user_id_organization_id_role_key" ON "memberships"("user_id", "organization_id", "role") NULLS NOT DISTINCT;
