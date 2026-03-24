import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    await utils.queryInterface.removeColumn('userExport', 'fileUrl', { transaction })
    await utils.queryInterface.removeColumn('videoSource', 'fileUrl', { transaction })
  }

  const tablesToUpdate = [ 'actorImage', 'thumbnail', 'videoCaption', 'storyboard' ]

  for (const table of tablesToUpdate) {
    await utils.queryInterface.addColumn(table, 'cached', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }, { transaction })

    await utils.queryInterface.changeColumn(table, 'cached', {
      type: Sequelize.BOOLEAN,
      defaultValue: null,
      allowNull: false
    }, { transaction })
  }

  {
    await utils.queryInterface.removeColumn('actorImage', 'onDisk', { transaction: utils.transaction })
    await utils.queryInterface.removeColumn('thumbnail', 'onDisk', { transaction: utils.transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
