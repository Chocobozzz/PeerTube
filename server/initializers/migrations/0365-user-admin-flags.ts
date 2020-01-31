import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const data = {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: true
    }
    await utils.queryInterface.addColumn('user', 'adminFlags', data)
  }

  {
    const query = 'UPDATE "user" SET "adminFlags" = 0'
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: false
    }
    await utils.queryInterface.changeColumn('user', 'adminFlags', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
