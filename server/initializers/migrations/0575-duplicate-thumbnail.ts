import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const query = 'DELETE FROM "thumbnail" s1 ' +
      'USING (SELECT MIN(id) as id, "filename", "type" FROM "thumbnail" GROUP BY "filename", "type" HAVING COUNT(*) > 1) s2 ' +
      'WHERE s1."filename" = s2."filename" AND s1."type" = s2."type" AND s1.id <> s2.id'
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
