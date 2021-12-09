import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    for (const column of [ 'avatarMiniatureId' ]) {
      const data = {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null
      }

      await utils.queryInterface.addColumn('actor', column, data)
    }
  }
}

function down () {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
