import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.sequelize.query(`
    CREATE TABLE IF NOT EXISTS "abuseMessage" (
      "id" serial,
      "message" text NOT NULL,
      "byModerator" boolean NOT NULL,
      "accountId" integer REFERENCES "account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      "abuseId" integer NOT NULL REFERENCES "abuse" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "createdAt" timestamp WITH time zone NOT NULL,
      "updatedAt" timestamp WITH time zone NOT NULL,
      PRIMARY KEY ("id")
    );
  `)

  const notificationSettingColumns = [ 'abuseStateChange', 'abuseNewMessage' ]

  for (const column of notificationSettingColumns) {
    const data = {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: true
    }
    await utils.queryInterface.addColumn('userNotificationSetting', column, data)
  }

  {
    const query = 'UPDATE "userNotificationSetting" SET "abuseStateChange" = 3, "abuseNewMessage" = 3'
    await utils.sequelize.query(query)
  }

  for (const column of notificationSettingColumns) {
    const data = {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: false
    }
    await utils.queryInterface.changeColumn('userNotificationSetting', column, data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
