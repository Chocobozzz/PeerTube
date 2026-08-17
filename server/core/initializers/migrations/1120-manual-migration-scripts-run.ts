import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  await utils.queryInterface.addColumn('application', 'manualMigrationScriptsRun', {
    type: Sequelize.ARRAY(Sequelize.STRING),
    allowNull: false,
    defaultValue: []
  }, { transaction })

  // Scripts that existed before this tracking system was introduced: assume already run
  const alreadyRun = [ 'peertube-4.0', 'peertube-4.2', 'peertube-5.0', 'peertube-6.3', 'peertube-7.2', 'peertube-8.0', 'peertube-8.1' ]

  await utils.sequelize.query(
    `UPDATE "application" SET "manualMigrationScriptsRun" = ARRAY[${alreadyRun.map(s => `'${s}'`).join(', ')}]`,
    { transaction }
  )
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
