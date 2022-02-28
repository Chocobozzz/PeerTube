import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    await utils.queryInterface.addColumn('videoJobInfo', 'pendingValidateVideo', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    }, { transaction: utils.transaction })
  }
}

function down () {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
