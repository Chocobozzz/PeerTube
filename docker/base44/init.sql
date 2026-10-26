-- PeerTube dev database setup (mirrors support/docker/gitpod/setup_postgres.sql)
-- The "peertube" role is created by the postgres image itself (POSTGRES_USER).
create database peertube_dev;
\c peertube_dev
create extension if not exists pg_trgm;
create extension if not exists unaccent;
