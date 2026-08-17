import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  await utils.sequelize.query(
    `CREATE TABLE IF NOT EXISTS "videoSearch" (
      "id" SERIAL,
      "videoId" INTEGER NOT NULL REFERENCES "video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "searchVector" tsvector NOT NULL,
      PRIMARY KEY ("id")
    )`,
    { transaction }
  )
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
