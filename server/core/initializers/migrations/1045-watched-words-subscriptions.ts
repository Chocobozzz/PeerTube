import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    const query = `
CREATE TABLE IF NOT EXISTS "watchedWordsSubscription" (
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
      `ALTER TABLE "watchedWordsList" ` +
        `ADD COLUMN IF NOT EXISTS "watchedWordsSubscriptionId" INTEGER REFERENCES "watchedWordsSubscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      { transaction }
    )
  }
}

function down () {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
