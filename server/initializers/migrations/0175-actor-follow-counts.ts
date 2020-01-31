import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const query = 'UPDATE "actor" SET ' +
  '"followersCount" = (SELECT COUNT(*) FROM "actorFollow" WHERE "actor"."id" = "actorFollow"."targetActorId"), ' +
  '"followingCount" = (SELECT COUNT(*) FROM "actorFollow" WHERE "actor"."id" = "actorFollow"."actorId") ' +
  'WHERE "actor"."serverId" IS NULL'

  await utils.sequelize.query(query)
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
