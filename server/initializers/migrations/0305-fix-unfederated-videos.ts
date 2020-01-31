import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const query = `INSERT INTO "videoShare" (url, "actorId", "videoId", "createdAt", "updatedAt") ` +
      `(` +
        `SELECT ` +
        `video.url || '/announces/' || "videoChannel"."actorId" as url, ` +
        `"videoChannel"."actorId" AS "actorId", ` +
        `"video"."id" AS "videoId", ` +
        `NOW() AS "createdAt", ` +
        `NOW() AS "updatedAt" ` +
        `FROM video ` +
        `INNER JOIN "videoChannel" ON "video"."channelId" = "videoChannel"."id" ` +
        `WHERE "video"."remote" = false AND "video"."privacy" != 3 AND "video"."state" = 1` +
      `) ` +
      `ON CONFLICT DO NOTHING`

    await utils.sequelize.query(query)
  }

  {
    const query = `INSERT INTO "videoShare" (url, "actorId", "videoId", "createdAt", "updatedAt") ` +
      `(` +
        `SELECT ` +
        `video.url || '/announces/' || (SELECT id FROM actor WHERE "preferredUsername" = 'peertube' ORDER BY id ASC LIMIT 1) as url, ` +
        `(SELECT id FROM actor WHERE "preferredUsername" = 'peertube' ORDER BY id ASC LIMIT 1) AS "actorId", ` +
        `"video"."id" AS "videoId", ` +
        `NOW() AS "createdAt", ` +
        `NOW() AS "updatedAt" ` +
        `FROM video ` +
        `WHERE "video"."remote" = false AND "video"."privacy" != 3 AND "video"."state" = 1` +
      `) ` +
      `ON CONFLICT DO NOTHING`

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
