import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  try {
    await utils.sequelize.query('drop type "enum_actorFollow_state"')
    await utils.sequelize.query('alter type "enum_AccountFollows_state" rename to "enum_actorFollow_state";')
  } catch {
    // empty
  }

  try {
    await utils.sequelize.query('drop type "enum_accountVideoRate_type"')
    await utils.sequelize.query('alter type "enum_AccountVideoRates_type" rename to "enum_accountVideoRate_type";')
  } catch {
    // empty
  }
}

async function down (utils: {
  queryInterface: Sequelize.QueryInterface
  transaction: Sequelize.Transaction
}) {
}

export {
  up,
  down
}
