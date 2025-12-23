import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const query = `CREATE TABLE IF NOT EXISTS "playerSetting" (
  "id"   SERIAL,
  "theme" VARCHAR(255) NOT NULL DEFAULT 'instance-default',
  "videoId" INTEGER REFERENCES "video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "channelId" INTEGER REFERENCES "videoChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);`

  await utils.sequelize.query(query, { transaction: utils.transaction })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
