import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {

  {
    const query = 'DELETE FROM "videoFile" f1 ' +
      'USING (SELECT MIN(id) as id, "torrentFilename" FROM "videoFile" GROUP BY "torrentFilename" HAVING COUNT(*) > 1) f2 ' +
      'WHERE f1."torrentFilename" = f2."torrentFilename" AND f1.id <> f2.id'
    await utils.sequelize.query(query)
  }

  {
    const query = 'DELETE FROM "videoFile" f1 ' +
      'USING (SELECT MIN(id) as id, "filename" FROM "videoFile" GROUP BY "filename" HAVING COUNT(*) > 1) f2 ' +
      'WHERE f1."filename" = f2."filename" AND f1.id <> f2.id'
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
