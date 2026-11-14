CREATE TABLE IF NOT EXISTS incident_links (
  id bigserial PRIMARY KEY,
  incident_id bigint NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  linked_incident_id bigint NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  link_type text NOT NULL DEFAULT 'related',
  note text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(incident_id, linked_incident_id)
);