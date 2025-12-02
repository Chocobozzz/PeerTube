import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.sequelize.query('DROP TABLE "actorReserved"', { transaction: utils.transaction })

  {
    const query = `
CREATE TABLE IF NOT EXISTS "actorReserved" (
  "id" SERIAL,
  "preferredUsername" VARCHAR(255) NOT NULL,
  "publicKey" VARCHAR(5000) NOT NULL,
  "privateKey" VARCHAR(5000) NOT NULL,
  "url" VARCHAR(2000) NOT NULL,
  "actorId" INTEGER NOT NULL,
  "accountId" INTEGER,
  "videoChannelId" INTEGER,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
)`

    await utils.sequelize.query(query, { transaction: utils.transaction })
  }

  {
    await utils.sequelize.query(
      `
      INSERT INTO "actorReserved"
        ("preferredUsername", "publicKey", "privateKey", "url", "actorId", "accountId", "videoChannelId", "createdAt", "updatedAt")
      SELECT "preferredUsername", "publicKey", "privateKey", "url", "id", "accountId", "videoChannelId", NOW(), NOW()
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
