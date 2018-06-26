import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  // waitingTranscoding column
  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('video', 'waitTranscoding', data)
  }

  {
    const query = 'UPDATE video SET "waitTranscoding" = false'
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('video', 'waitTranscoding', data)
  }

  // state
  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('video', 'state', data)
  }

  {
    // Published
    const query = 'UPDATE video SET "state" = 1'
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('video', 'state', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
