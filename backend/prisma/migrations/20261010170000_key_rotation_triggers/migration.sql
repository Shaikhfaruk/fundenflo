CREATE OR REPLACE FUNCTION key_rotation_change_only(row_before jsonb, row_after jsonb, rotated_column text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT current_setting('fundenflo.key_rotation', true) = 'on'
     AND (row_after - rotated_column) IS NOT DISTINCT FROM (row_before - rotated_column)
$$;

CREATE OR REPLACE FUNCTION immutable_except_party_id_or_key_rotation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'party_id') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'party_id') THEN
    RETURN NEW;
  END IF;
  IF key_rotation_change_only(to_jsonb(OLD), to_jsonb(NEW), TG_ARGV[0]) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END
$$;

CREATE OR REPLACE FUNCTION append_only_except_key_rotation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF key_rotation_change_only(to_jsonb(OLD), to_jsonb(NEW), TG_ARGV[0]) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END
$$;

DROP TRIGGER borrower_facts_immutable ON borrower_facts;

CREATE TRIGGER borrower_facts_immutable
  BEFORE UPDATE ON borrower_facts
  FOR EACH ROW EXECUTE FUNCTION immutable_except_party_id_or_key_rotation('value_enc');

DROP TRIGGER submission_packets_append_only ON submission_packets;

CREATE TRIGGER submission_packets_no_delete
  BEFORE DELETE ON submission_packets
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER submission_packets_append_only
  BEFORE UPDATE ON submission_packets
  FOR EACH ROW EXECUTE FUNCTION append_only_except_key_rotation('snapshot');
