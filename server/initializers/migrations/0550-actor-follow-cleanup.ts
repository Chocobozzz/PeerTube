import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const query = `
    WITH t AS (
      SELECT actor.id FROM actor
      LEFT JOIN "videoChannel" ON "videoChannel"."actorId" = actor.id
      LEFT JOIN account ON account."actorId" = "actor"."id"
      WHERE "videoChannel".id IS NULL and "account".id IS NULL
    ) DELETE FROM "actorFollow" WHERE "actorId" IN (SELECT t.id FROM t) OR "targetActorId" in (SELECT t.id FROM t)
  `

  await utils.sequelize.query(query)
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
