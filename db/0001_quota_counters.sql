CREATE TABLE IF NOT EXISTS quota_counters (
  day TEXT NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('visitor', 'global')),
  hash TEXT NOT NULL,
  counter INTEGER NOT NULL CHECK (counter >= 0),
  PRIMARY KEY (day, bucket, hash)
);
