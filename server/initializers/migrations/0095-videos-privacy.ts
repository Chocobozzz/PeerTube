import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const q = utils.queryInterface

  const data = {
    type: Sequelize.INTEGER,
    defaultValue: null,
    allowNull: true
  }
  await q.addColumn('Videos', 'privacy', data)

  const query = 'UPDATE "Videos" SET "privacy" = 1'
  const options = {
    type: Sequelize.QueryTypes.BULKUPDATE
  }
  await utils.sequelize.query(query, options)

  data.allowNull = false
  await q.changeColumn('Videos', 'privacy', data)
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
