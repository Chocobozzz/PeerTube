import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  const query = 'DELETE FROM "runner" r1 ' +
    'USING (SELECT MIN(id) as id, "name" FROM "runner" GROUP BY "name" HAVING COUNT(*) > 1) r2 ' +
    'WHERE r1."name" = r2."name" AND r1.id <> r2.id'

  await utils.sequelize.query(query, { transaction })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
