-- Move PostGIS extension to 'extensions' schema for security best practice
DROP EXTENSION IF EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;