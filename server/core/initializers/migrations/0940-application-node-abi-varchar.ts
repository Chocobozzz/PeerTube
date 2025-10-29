import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    await utils.sequelize.query(
      `ALTER TABLE "application" ALTER COLUMN "nodeABIVersion" TYPE VARCHAR(255)`,
      { transaction: utils.transaction }
    )
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
