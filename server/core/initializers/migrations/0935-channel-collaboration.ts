import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    const query = `CREATE TABLE IF NOT EXISTS "videoChannelCollaborator" (
  "id" SERIAL,
  "state" INTEGER NOT NULL,
  "accountId" INTEGER REFERENCES "account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "channelId" INTEGER NOT NULL REFERENCES "videoChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
)`

    await utils.sequelize.query(query, { transaction: utils.transaction })
  }

  {
    const metadata = {
      type: Sequelize.JSONB,
      allowNull: true
    }
    await utils.queryInterface.addColumn('userNotification', 'data', metadata, { transaction: utils.transaction })
  }

  {
    await utils.sequelize.query(
      `ALTER TABLE "userNotification" ` +
        `ADD COLUMN "channelCollaboratorId" INTEGER REFERENCES "videoChannelCollaborator" ("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      { transaction: utils.transaction }
    )
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
