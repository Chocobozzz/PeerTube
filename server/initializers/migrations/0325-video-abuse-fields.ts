import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {

  {
    const data = {
      type: Sequelize.STRING(3000),
      allowNull: false,
      defaultValue: null
    }

    await utils.queryInterface.changeColumn('videoAbuse', 'reason', data)
  }

  {
    const data = {
      type: Sequelize.STRING(3000),
      allowNull: true,
      defaultValue: null
    }

    await utils.queryInterface.changeColumn('videoAbuse', 'moderationComment', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
