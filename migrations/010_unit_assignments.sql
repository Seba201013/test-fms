CREATE TABLE IF NOT EXISTS incident_unit_assignments (
  id bigserial PRIMARY KEY,
  incident_id bigint NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  unit_code text NOT NULL,
  status text NOT NULL DEFAULT 'assigned',
  assigned_by text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  enroute_at timestamptz,
  arrived_at timestamptz,
  released_at timestamptz,
  UNIQUE(incident_id, unit_code)
);