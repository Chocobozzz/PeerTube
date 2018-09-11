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

    await utils.queryInterface.addColumn('server', 'redundancyAllowed', data)
  }

}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
