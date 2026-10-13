-- Tenant picture, stored as a small JPEG/PNG/WebP data URL (the web app crops and shrinks it before upload).
-- Already included in schema_oracle.sql. Run this file on its own only if your database was created before tenant pictures existed.
ALTER TABLE tenant ADD photo_data CLOB;
