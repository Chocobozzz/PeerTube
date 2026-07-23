import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  // Only keep the most recent one of each size to create unique indexes
  for (const column of [ 'videoId', 'videoPlaylistId' ]) {
    const query = 'DELETE FROM "thumbnail" t1 ' +
      `USING (SELECT MAX("id") AS "id", "${column}", "width", "height" FROM "thumbnail" ` +
      `WHERE "${column}" IS NOT NULL AND "width" IS NOT NULL AND "height" IS NOT NULL ` +
      `GROUP BY "${column}", "width", "height" HAVING COUNT(*) > 1) t2 ` +
      `WHERE t1."${column}" = t2."${column}" AND t1."width" = t2."width" AND t1."height" = t2."height" AND t1."id" <> t2."id"`

    await utils.sequelize.query(query, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
