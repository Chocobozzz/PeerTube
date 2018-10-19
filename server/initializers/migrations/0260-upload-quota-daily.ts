import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {
  {
    const data = {
      type: Sequelize.BIGINT,
      allowNull: false,
      defaultValue: -1
    }
    await utils.queryInterface.addColumn('user', 'videoQuotaDaily', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
