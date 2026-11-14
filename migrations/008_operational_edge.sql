CREATE TABLE IF NOT EXISTS incident_tasks (
  id bigserial PRIMARY KEY,
  incident_id bigint NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  title text NOT NULL,
  detail text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  assigned_unit text,
  assigned_to text,
  due_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);