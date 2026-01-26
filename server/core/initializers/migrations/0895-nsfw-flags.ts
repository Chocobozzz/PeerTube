import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    await utils.queryInterface.addColumn('video', 'nsfwSummary', {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: true
    }, { transaction })

    await utils.queryInterface.addColumn('video', 'nsfwFlags', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    }, { transaction })
  }

  {
    await utils.queryInterface.addColumn('user', 'nsfwFlagsDisplayed', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    }, { transaction })

    await utils.queryInterface.addColumn('user', 'nsfwFlagsHidden', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    }, { transaction })

    await utils.queryInterface.addColumn('user', 'nsfwFlagsWarned', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    }, { transaction })

    await utils.queryInterface.addColumn('user', 'nsfwFlagsBlurred', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
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
