import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {

  {
    const description = {
      type: Sequelize.STRING(1000),
      allowNull: true
    }
    await utils.queryInterface.changeColumn('videoPlaylist', 'description', description)
  }

}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
