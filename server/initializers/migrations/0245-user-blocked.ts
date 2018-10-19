import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {
  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('user', 'blocked', data)
  }

  {
    const query = 'UPDATE "user" SET "blocked" = false'
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('user', 'blocked', data)
  }

  {
    const data = {
      type: Sequelize.STRING(250),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('user', 'blockedReason', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
