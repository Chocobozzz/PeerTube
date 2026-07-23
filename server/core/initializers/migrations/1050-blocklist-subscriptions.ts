import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    const query = `
CREATE TABLE IF NOT EXISTS "blocklistSubscription" (
  "id" SERIAL,
  "name" VARCHAR(255) NOT NULL,
  "url" VARCHAR(255) NOT NULL,
  "lastSyncAt" TIMESTAMP WITH TIME ZONE,
  "lastActionCreatedAt" TIMESTAMP WITH TIME ZONE,
  "state" INTEGER NOT NULL DEFAULT 1,
  "accountId" INTEGER NOT NULL REFERENCES "account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);`

    await utils.sequelize.query(query, { transaction })
  }

  {
    await utils.sequelize.query(
      `ALTER TABLE "accountBlocklist" ` +
        `ADD COLUMN IF NOT EXISTS "blocklistSubscriptionId" INTEGER REFERENCES "blocklistSubscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      { transaction }
    )
  }

  {
    await utils.sequelize.query(
      `ALTER TABLE "serverBlocklist" ` +
        `ADD COLUMN IF NOT EXISTS "blocklistSubscriptionId" INTEGER REFERENCES "blocklistSubscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      { transaction }
    )
  }

  {
    await utils.sequelize.query(`CREATE TYPE "enum_blocklistLog_action" AS ENUM ('add', 'delete');`, { transaction })

    const query = `
CREATE TABLE IF NOT EXISTS "blocklistLog" (
  "id" SERIAL,
  "action" "public"."enum_blocklistLog_action",
  "automaticallyCreated" BOOLEAN,
  "accountId" INTEGER REFERENCES "account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "blocklistSubscriptionId" INTEGER REFERENCES "blocklistSubscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "target" VARCHAR(255),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);`

    await utils.sequelize.query(query, { transaction })
  }
}

function down () {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
