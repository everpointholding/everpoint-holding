CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  access_salt TEXT NOT NULL,
  access_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  chat_enabled INTEGER NOT NULL DEFAULT 1,
  steps_json TEXT NOT NULL DEFAULT '[false,false,false,false,false,false]',
  docs_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  dob TEXT NOT NULL,
  address TEXT NOT NULL,
  role TEXT NOT NULL,
  employment_type TEXT NOT NULL,
  work_arrangement TEXT NOT NULL,
  employment_status TEXT NOT NULL,
  experience TEXT NOT NULL,
  education TEXT NOT NULL,
  skills TEXT NOT NULL,
  history TEXT NOT NULL,
  motivation TEXT NOT NULL,
  availability TEXT NOT NULL,
  teams TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('employee','admin')),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  audience TEXT NOT NULL CHECK (audience IN ('admin','employee')),
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  related TEXT NOT NULL,
  file_name TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Submitted',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('admin','employee')),
  subject_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_messages_employee ON messages(employee_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_employee ON notifications(employee_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_uploads_employee ON uploads(employee_id, created_at);
CREATE INDEX IF NOT EXISTS idx_applications_created ON applications(created_at);
