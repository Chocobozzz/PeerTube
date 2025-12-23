import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    const query = `
CREATE TABLE IF NOT EXISTS "actorReserved" (
  "id" SERIAL,
  "preferredUsername" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
)`

    await utils.sequelize.query(query, { transaction: utils.transaction })
  }

  {
    const query = `ALTER TABLE "actor" ADD COLUMN IF NOT EXISTS "accountId" INTEGER ` +
      `REFERENCES "account" ("id") ON DELETE CASCADE ON UPDATE CASCADE`
    await utils.sequelize.query(query, { transaction: utils.transaction })
  }

  {
    const query = `ALTER TABLE "actor" ADD COLUMN IF NOT EXISTS "videoChannelId" INTEGER ` +
      `REFERENCES "videoChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE`
    await utils.sequelize.query(query, { transaction: utils.transaction })
  }

  // ---------------------------------------------------------------------------

  {
    await utils.sequelize.query(
      `
      INSERT INTO "actorReserved" ("preferredUsername", "createdAt", "updatedAt")
      SELECT "preferredUsername", NOW(), NOW()
      FROM "actor"
      WHERE "accountId" IS NULL AND "videoChannelId" IS NULL AND "serverId" IS NULL
    `,
      { transaction: utils.transaction }
    )
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
