import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    await utils.queryInterface.addColumn('videoCaption', 'm3u8Filename', {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: true
    }, { transaction })
  }

  {
    await utils.queryInterface.addColumn('videoCaption', 'm3u8Url', {
      type: Sequelize.STRING,
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
