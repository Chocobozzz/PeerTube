import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    await utils.queryInterface.removeColumn('thumbnail', 'type', { transaction: utils.transaction })
  }

  {
    const query = 'DELETE FROM "thumbnail" s1 ' +
      'USING (SELECT MIN(id) as id, "filename" FROM "thumbnail" GROUP BY "filename" HAVING COUNT(*) > 1) s2 ' +
      'WHERE s1."filename" = s2."filename" AND s1.id <> s2.id'
    await utils.sequelize.query(query, { transaction: utils.transaction })
  }

  {
    await utils.sequelize.query('DROP INDEX IF EXISTS thumbnail_filename_type', { transaction: utils.transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
