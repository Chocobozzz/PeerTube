import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    const dataKeptOriginalFilename = {
      type: Sequelize.STRING,
      allowNull: true
    }

    await utils.queryInterface.addColumn('videoSource', 'keptOriginalFilename', dataKeptOriginalFilename, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
