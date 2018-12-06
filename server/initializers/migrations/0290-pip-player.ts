import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {
  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }

    await utils.queryInterface.addColumn('user', 'pipPlayer', data)
  }

}

async function down (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {
  await utils.queryInterface.removeColumn('user', 'pipPlayer')
}

export { up, down }
