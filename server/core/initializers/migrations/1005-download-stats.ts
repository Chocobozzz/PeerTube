import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    await utils.queryInterface.addColumn('video', 'downloads', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    }, { transaction: utils.transaction })

    await utils.queryInterface.renameTable('videoView', 'videoStat', { transaction: utils.transaction })

    await utils.queryInterface.addColumn('videoStat', 'downloads', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    }, { transaction: utils.transaction })
  }
}

async function down (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.queryInterface.removeColumn('video', 'downloads', { transaction: utils.transaction })
  await utils.queryInterface.removeColumn('videoStat', 'downloads', { transaction: utils.transaction })

  await utils.queryInterface.renameTable('videoStat', 'videoView', { transaction: utils.transaction })
}

export { up, down }
