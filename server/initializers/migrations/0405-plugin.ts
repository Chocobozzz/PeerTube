import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const query = `
CREATE TABLE IF NOT EXISTS "plugin"
(
  "id"             SERIAL,
  "name"           VARCHAR(255)             NOT NULL,
  "type"           INTEGER                  NOT NULL,
  "version"        VARCHAR(255)             NOT NULL,
  "latestVersion"  VARCHAR(255),
  "enabled"        BOOLEAN                  NOT NULL,
  "uninstalled"    BOOLEAN                  NOT NULL,
  "peertubeEngine" VARCHAR(255)             NOT NULL,
  "description"    VARCHAR(255),
  "homepage"       VARCHAR(255)             NOT NULL,
  "settings"       JSONB,
  "storage"        JSONB,
  "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt"      TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);`
    await utils.sequelize.query(query)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
