import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    await utils.sequelize.query(
      'DELETE FROM "actor" v1 USING (SELECT MIN(id) as id, "preferredUsername", "serverId" FROM "actor" ' +
      'GROUP BY "preferredUsername", "serverId" HAVING COUNT(*) > 1 AND "serverId" IS NOT NULL) v2 ' +
      'WHERE v1."preferredUsername" = v2."preferredUsername" AND v1."serverId" = v2."serverId" AND v1.id <> v2.id'
    )
  }

  {
    await utils.sequelize.query(
      'DELETE FROM "actor" v1 USING (SELECT MIN(id) as id, "url" FROM "actor" GROUP BY "url" HAVING COUNT(*) > 1) v2 ' +
      'WHERE v1."url" = v2."url" AND v1.id <> v2.id'
    )
  }

  {
    await utils.sequelize.query(
      'DELETE FROM "tag" v1 USING (SELECT MIN(id) as id, "name" FROM "tag" GROUP BY "name" HAVING COUNT(*) > 1) v2 ' +
      'WHERE v1."name" = v2."name" AND v1.id <> v2.id'
    )
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
