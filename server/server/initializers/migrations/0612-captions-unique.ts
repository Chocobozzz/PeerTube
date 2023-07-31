import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {

  await utils.sequelize.query(
    'DELETE FROM "videoCaption" v1 USING (SELECT MIN(id) as id, "filename" FROM "videoCaption" ' +
    'GROUP BY "filename" HAVING COUNT(*) > 1) v2 WHERE v1."filename" = v2."filename" AND v1.id <> v2.id'
  )
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
