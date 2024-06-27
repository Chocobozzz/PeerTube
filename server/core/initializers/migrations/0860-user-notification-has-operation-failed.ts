import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const { transaction } = utils

  {
    const data = {
      type: Sequelize.BOOLEAN,
      defaultValue: null,
      allowNull: true
    }
    await utils.queryInterface.addColumn('userNotification', 'hasOperationFailed', data, { transaction })
  }

  {
    const query = 'UPDATE "userNotification" SET "hasOperationFailed" = false'
    await utils.sequelize.query(query, { transaction })
  }

  {
    const data = {
      type: Sequelize.BOOLEAN,
      defaultValue: null,
      allowNull: false
    }
    await utils.queryInterface.changeColumn('userNotification', 'hasOperationFailed', data, { transaction })
  }
}

function down () {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
