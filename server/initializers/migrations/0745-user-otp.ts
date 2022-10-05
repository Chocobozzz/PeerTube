import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const { transaction } = utils

  const data = {
    type: Sequelize.STRING,
    defaultValue: null,
    allowNull: true
  }
  await utils.queryInterface.addColumn('user', 'otpSecret', data, { transaction })

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
