import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const query = `
    UPDATE "actorFollow" SET url = follower.url || '/follows/' || following.id
    FROM actor follower, actor following
    WHERE follower."serverId" IS NULL AND follower.id = "actorFollow"."actorId" AND following.id = "actorFollow"."targetActorId"
    `

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
