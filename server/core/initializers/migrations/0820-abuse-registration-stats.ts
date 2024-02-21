import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    const data = {
      type: Sequelize.DATE,
      defaultValue: null,
      allowNull: true
    }
    await utils.queryInterface.addColumn('userRegistration', 'processedAt', data)
  }

  {
    const data = {
      type: Sequelize.DATE,
      defaultValue: null,
      allowNull: true
    }
    await utils.queryInterface.addColumn('abuse', 'processedAt', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
