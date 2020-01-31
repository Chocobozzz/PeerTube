import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    const query = 'DELETE FROM "videoComment" s1 ' +
      'USING (SELECT MIN(id) as id, url FROM "videoComment" GROUP BY "url" HAVING COUNT(*) > 1) s2 ' +
      'WHERE s1."url" = s2."url" AND s1.id <> s2.id'
    await utils.sequelize.query(query)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
