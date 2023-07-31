import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const { transaction } = utils

  await utils.sequelize.query('drop index if exists "actor_preferred_username"', { transaction })
  await utils.sequelize.query('drop index if exists "actor_preferred_username_server_id"', { transaction })

  await utils.sequelize.query(
    'DELETE FROM "actor" v1 USING (' +
      'SELECT MIN(id) as id, lower("preferredUsername") AS "lowerPreferredUsername", "serverId" ' +
      'FROM "actor" ' +
      'GROUP BY "lowerPreferredUsername", "serverId" HAVING COUNT(*) > 1 AND "serverId" IS NOT NULL' +
    ') v2 ' +
    'WHERE lower(v1."preferredUsername") = v2."lowerPreferredUsername" AND v1."serverId" = v2."serverId" AND v1.id <> v2.id',
    { transaction }
  )

  await utils.sequelize.query(
    'DELETE FROM "actor" v1 USING (' +
      'SELECT MIN(id) as id, lower("preferredUsername") AS "lowerPreferredUsername", "serverId" ' +
      'FROM "actor" ' +
      'GROUP BY "lowerPreferredUsername", "serverId" HAVING COUNT(*) > 1 AND "serverId" IS NULL' +
    ') v2 ' +
    'WHERE lower(v1."preferredUsername") = v2."lowerPreferredUsername" AND v1."serverId" IS NULL AND v1.id <> v2.id',
    { transaction }
  )
}

async function down (utils: {
  queryInterface: Sequelize.QueryInterface
  transaction: Sequelize.Transaction
}) {
}

export {
  up,
  down
}
