import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  await utils.sequelize.query(
    `DELETE FROM "videoPlaylist" WHERE "id" IN (` +
      `SELECT "id" FROM (` +
      `SELECT "id", ROW_NUMBER() OVER (PARTITION BY "uuid" ORDER BY "id" ASC) AS "rank" FROM "videoPlaylist"` +
      `) "t" WHERE "t"."rank" > 1` +
      `)`,
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
