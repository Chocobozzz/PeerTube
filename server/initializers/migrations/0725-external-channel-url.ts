import * as Sequelize from 'sequelize'
import { CONSTRAINTS_FIELDS } from '../constants'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const externalChannelUrlMaxLength = CONSTRAINTS_FIELDS.VIDEO_CHANNEL_SYNCS.EXTERNAL_CHANNEL_URL.max
  const query = `
    CREATE TABLE IF NOT EXISTS "videoChannelSync" (
      "id"   SERIAL,
      "externalChannelUrl" VARCHAR(${externalChannelUrlMaxLength}) NOT NULL DEFAULT NULL,
      "videoChannelId" INTEGER NOT NULL REFERENCES "videoChannel" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      "state" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      PRIMARY KEY ("id")
    );
  `
  await utils.sequelize.query(query, { transaction: utils.transaction })
}

async function down (utils: {
  queryInterface: Sequelize.QueryInterface
  transaction: Sequelize.Transaction
}) {
  await utils.queryInterface.dropTable('videoChannelSync', { transaction: utils.transaction })
}

export {
  up,
  down
}
