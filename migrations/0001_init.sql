PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount_kobo INTEGER NOT NULL,
  interval TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO plans (id, name, amount_kobo, interval)
VALUES ('premium-monthly', 'TOMA Premium Monthly', 150000, 'monthly');

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL,
  paystack_customer_code TEXT,
  paystack_subscription_code TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  plan_code TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS titles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  synopsis TEXT,
  type TEXT NOT NULL CHECK (type IN ('movie','series')),
  genre TEXT,
  release_year INTEGER,
  maturity_rating TEXT,
  poster_url TEXT,
  backdrop_url TEXT,
  stream_uid TEXT,
  is_premium INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  title_id TEXT NOT NULL,
  season_number INTEGER NOT NULL,
  name TEXT,
  FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  synopsis TEXT,
  duration_seconds INTEGER,
  stream_uid TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watch_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title_id TEXT NOT NULL,
  progress_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (title_id) REFERENCES titles(id)
);

CREATE TABLE IF NOT EXISTS watchlist (
  user_id TEXT NOT NULL,
  title_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, title_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (title_id) REFERENCES titles(id)
);

CREATE INDEX IF NOT EXISTS idx_titles_published ON titles(is_published, type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email, status);
