import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  await utils.sequelize.query(
    `CREATE TABLE "videoSearch" (
      "videoId" INTEGER NOT NULL REFERENCES "video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "searchVector" tsvector NOT NULL
    )`,
    { transaction }
  )
}

function down (options) {
  throw new Error('Not implemented.')
}

export { down, up }