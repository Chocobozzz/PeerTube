import * as Sequelize from 'sequelize'
import { QueryTypes } from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const batchSize = 1000

  // ---------------------------------------------------------------------------
  // Do not use transaction on purpose, to speed up chunk updates
  // ---------------------------------------------------------------------------

  // Fill "actor"."accountId"
  while (true) {
    const query = `
WITH batch AS (
  SELECT a."id" AS actor_id, ac."id" AS account_id
  FROM "actor" a INNER JOIN "account" ac ON ac."actorId" = a."id"
  WHERE a."accountId" IS DISTINCT FROM ac."id" ORDER BY a."id"
  LIMIT ${batchSize}
) UPDATE "actor" SET "accountId" = batch.account_id FROM batch WHERE "actor"."id" = batch.actor_id`

    const [ , rowsUpdated ] = await utils.sequelize.query(query, {
      type: QueryTypes.UPDATE,
      replacements: { limit: batchSize }
    })

    if (rowsUpdated < batchSize) {
      break
    }
  }

  // Fill "actor"."videoChannelId"
  while (true) {
    const query = `
WITH batch AS (
  SELECT a."id" AS actor_id, vc."id" AS channel_id
  FROM "actor" a INNER JOIN "videoChannel" vc ON vc."actorId" = a."id"
  WHERE a."videoChannelId" IS DISTINCT FROM vc."id" ORDER BY a."id"
  LIMIT ${batchSize}
) UPDATE "actor" SET "videoChannelId" = batch.channel_id FROM batch WHERE "actor"."id" = batch.actor_id`

    const [ , rowsUpdated ] = await utils.sequelize.query(query, {
      type: QueryTypes.UPDATE,
      replacements: { limit: batchSize }
    })

    if (rowsUpdated < batchSize) {
      break
    }
  }

  // ---------------------------------------------------------------------------

  {
    await utils.sequelize.query(`ALTER TABLE "account" DROP COLUMN "actorId"`, { transaction: utils.transaction })
    await utils.sequelize.query(`ALTER TABLE "videoChannel" DROP COLUMN "actorId"`, { transaction: utils.transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
