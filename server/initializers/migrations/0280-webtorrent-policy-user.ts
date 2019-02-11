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
      defaultValue: true
    }

    await utils.queryInterface.addColumn('user', 'webTorrentEnabled', data)
  }

}

async function down (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {
  await utils.queryInterface.removeColumn('user', 'webTorrentEnabled')
}

export { up, down }
