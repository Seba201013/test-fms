CREATE TABLE staff_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  callsign TEXT,
  rank TEXT NOT NULL DEFAULT 'Member',
  role TEXT NOT NULL DEFAULT 'officer',
  division TEXT NOT NULL DEFAULT 'National',
  active BOOLEAN NOT NULL DEFAULT true,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE units (
  id BIGSERIAL PRIMARY KEY,
  unit_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit_type TEXT NOT NULL DEFAULT 'patrol',
  division TEXT NOT NULL DEFAULT 'National',
  radio_channel TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  crew JSONB NOT NULL DEFAULT '[]'::jsonb,
  location_text TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE incidents (
  id BIGSERIAL PRIMARY KEY,
  incident_no TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT '999',
  priority TEXT NOT NULL DEFAULT 'P3',
  category TEXT NOT NULL,
  subtype TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  caller_name TEXT,
  caller_phone TEXT,
  location_text TEXT NOT NULL,
  eircode TEXT,
  summary TEXT NOT NULL,
  risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  assigned_units JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE incident_logs (
  id BIGSERIAL PRIMARY KEY,
  incident_id BIGINT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL DEFAULT 'note',
  body TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE persons (
  id BIGSERIAL PRIMARY KEY,
  ref_no TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  address TEXT,
  phone TEXT,
  warning_markers JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE custody_records (
  id BIGSERIAL PRIMARY KEY,
  custody_no TEXT NOT NULL UNIQUE,
  person_id BIGINT REFERENCES persons(id),
  person_name TEXT NOT NULL,
  arresting_unit TEXT,
  station TEXT NOT NULL,
  reason TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'standard',
  property JSONB NOT NULL DEFAULT '[]'::jsonb,
  observations JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'in_custody',
  booked_by TEXT,
  booked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public_reports (
  id BIGSERIAL PRIMARY KEY,
  report_no TEXT NOT NULL UNIQUE,
  report_type TEXT NOT NULL,
  reporter_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  location_text TEXT,
  details TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'routine',
  status TEXT NOT NULL DEFAULT 'received',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidents_status_priority ON incidents(status, priority, created_at DESC);
CREATE INDEX idx_incident_logs_incident ON incident_logs(incident_id, created_at);
CREATE INDEX idx_custody_status ON custody_records(status, booked_at DESC);
CREATE INDEX idx_public_reports_status ON public_reports(status, created_at DESC);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);