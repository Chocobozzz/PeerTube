import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const query = `
      CREATE TABLE IF NOT EXISTS "userRegistration" (
        "id" serial,
        "state" integer NOT NULL,
        "registrationReason" text NOT NULL,
        "moderationResponse" text,
        "password" varchar(255),
        "username" varchar(255) NOT NULL,
        "email" varchar(400) NOT NULL,
        "emailVerified" boolean,
        "accountDisplayName" varchar(255),
        "channelHandle" varchar(255),
        "channelDisplayName" varchar(255),
        "userId" integer REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
        "createdAt" timestamp with time zone NOT NULL,
        "updatedAt" timestamp with time zone NOT NULL,
        PRIMARY KEY ("id")
      );
    `
    await utils.sequelize.query(query, { transaction: utils.transaction })
  }

  {
    await utils.queryInterface.addColumn('userNotification', 'userRegistrationId', {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: true,
      references: {
        model: 'userRegistration',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    }, { transaction: utils.transaction })
  }
}

async function down (utils: {
  queryInterface: Sequelize.QueryInterface
  transaction: Sequelize.Transaction
}) {
  await utils.queryInterface.dropTable('videoChannelSync', { transaction: utils.transaction })
}

export {
  up,
  down
}
