-- Property photo, stored as a small JPEG/PNG/WebP data URL (the web app shrinks it before upload).
-- Already included in schema_oracle.sql. Run this file on its own only if your database was created before property images existed.
ALTER TABLE property ADD image_data CLOB;
