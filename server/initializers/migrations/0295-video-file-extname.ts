import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    await utils.queryInterface.renameColumn('videoFile', 'extname', 'extname_old')
  }

  {
    const data = {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: true
    }

    await utils.queryInterface.addColumn('videoFile', 'extname', data)
  }

  {
    const query = 'UPDATE "videoFile" SET "extname" = "extname_old"::text'
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: false
    }
    await utils.queryInterface.changeColumn('videoFile', 'extname', data)
  }

  {
    await utils.queryInterface.removeColumn('videoFile', 'extname_old')
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
