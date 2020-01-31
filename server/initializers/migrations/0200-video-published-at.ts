import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {

  {
    const data = {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: Sequelize.NOW
    }
    await utils.queryInterface.addColumn('video', 'publishedAt', data)
  }

  {
    const query = 'UPDATE video SET "publishedAt" = video."createdAt"'
    await utils.sequelize.query(query)
  }

  // Sequelize does not alter the column with NOW as default value
  {
    const data = {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW
    }
    await utils.queryInterface.changeColumn('video', 'publishedAt', data)
  }

}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
