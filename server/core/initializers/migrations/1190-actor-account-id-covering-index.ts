import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  // Will be re-created at startup
  await utils.sequelize.query(`DROP INDEX IF EXISTS "actor_account_id"`, { transaction })
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
