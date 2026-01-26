import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  const stringColumns = [
    'loginDevice',
    'loginIP',
    'lastActivityDevice',
    'lastActivityIP'
  ]

  for (const c of stringColumns) {
    await utils.queryInterface.addColumn('oAuthToken', c, {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: true
    }, { transaction })
  }

  const dateColumns = [
    'loginDate',
    'lastActivityDate'
  ]

  for (const c of dateColumns) {
    await utils.queryInterface.addColumn('oAuthToken', c, {
      type: Sequelize.DATE,
      defaultValue: null,
      allowNull: true
    }, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
