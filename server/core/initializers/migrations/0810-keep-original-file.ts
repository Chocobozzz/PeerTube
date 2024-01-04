import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    const dataKeptOriginalFile = {
      type: Sequelize.BOOLEAN,
      allowNull: false
    }

    await utils.queryInterface.addColumn('videoSource', 'keptOriginalFile', dataKeptOriginalFile, { transaction })
  }

  {
    const dataKeptOriginalFileName = {
      type: Sequelize.STRING,
      allowNull: true
    }

    await utils.queryInterface.addColumn('videoSource', 'keptOriginalFileName', dataKeptOriginalFileName, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
