import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  await utils.queryInterface.addColumn('videoImport', 'videoChannelSyncId', {
    type: Sequelize.INTEGER,
    defaultValue: null,
    allowNull: true,
    references: {
      model: 'videoChannelSync',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  }, { transaction: utils.transaction })
}

async function down (utils: {
  queryInterface: Sequelize.QueryInterface
  transaction: Sequelize.Transaction
}) {
  await utils.queryInterface.dropTable('videoChannelSync', { transaction: utils.transaction })
}

export {
  up,
  down
}
