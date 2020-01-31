import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const q = utils.queryInterface

  await q.renameColumn('Users', 'role', 'oldRole')

  const data = {
    type: Sequelize.INTEGER,
    allowNull: true
  }
  await q.addColumn('Users', 'role', data)

  let query = 'UPDATE "Users" SET "role" = 0 WHERE "oldRole" = \'admin\''
  await utils.sequelize.query(query)

  query = 'UPDATE "Users" SET "role" = 2 WHERE "oldRole" = \'user\''
  await utils.sequelize.query(query)

  data.allowNull = false
  await q.changeColumn('Users', 'role', data)

  await q.removeColumn('Users', 'oldRole')
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
