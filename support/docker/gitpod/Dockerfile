FROM gitpod/workspace-postgres

# Install PeerTube's dependencies.
RUN sudo apt-get update -q && sudo apt-get install -qy \
 ffmpeg \
 openssl \
 redis-server

# Set up PostgreSQL.
COPY --chown=gitpod:gitpod support/docker/gitpod/setup_postgres.sql /tmp/
RUN pg_start && psql -h localhost -d postgres --file=/tmp/setup_postgres.sql && pg_stop
