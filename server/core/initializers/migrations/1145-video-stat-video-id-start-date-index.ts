import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  await utils.sequelize.query(
    `DROP INDEX IF EXISTS "video_stat_video_id"`,
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
