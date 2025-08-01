import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  const query =
    // eslint-disable-next-line max-len
    `CREATE TABLE IF NOT EXISTS "videoLiveSchedule" ("id"   SERIAL , "startAt" TIMESTAMP WITH TIME ZONE NOT NULL, "liveVideoId" INTEGER REFERENCES "videoLive" ("id") ON DELETE CASCADE ON UPDATE CASCADE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("id"));`

  await utils.sequelize.query(query, { transaction })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
