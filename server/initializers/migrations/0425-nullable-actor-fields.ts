import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const data = {
    type: Sequelize.STRING,
    allowNull: true
  }

  await utils.queryInterface.changeColumn('actor', 'outboxUrl', data)
  await utils.queryInterface.changeColumn('actor', 'followersUrl', data)
  await utils.queryInterface.changeColumn('actor', 'followingUrl', data)
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
