import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.queryInterface.addColumn('videoAbuse', 'predefinedReasons', {
    type: Sequelize.ARRAY(Sequelize.INTEGER),
    allowNull: true
  })

  await utils.queryInterface.addColumn('videoAbuse', 'startAt', {
    type: Sequelize.INTEGER,
    allowNull: true
  })

  await utils.queryInterface.addColumn('videoAbuse', 'endAt', {
    type: Sequelize.INTEGER,
    allowNull: true
  })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
