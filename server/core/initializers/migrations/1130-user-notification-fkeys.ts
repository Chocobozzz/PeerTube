import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    await utils.sequelize.query(
      'DELETE FROM "userNotification" WHERE type IN (17) AND "pluginId" IS NULL',
      { transaction }
    )

    await utils.sequelize.query(
      'DELETE FROM "userNotification" WHERE type IN (18) AND "applicationId" IS NULL',
      { transaction }
    )

    await utils.sequelize.query(
      'DELETE FROM "userNotification" WHERE type IN (26, 27, 28, 29, 30, 31) AND "changeOwnershipId" IS NULL',
      { transaction }
    )
  }

  {
    await utils.sequelize.query(
      'ALTER TABLE "userNotification" DROP CONSTRAINT "userNotification_pluginId_fkey", ' +
        'ADD CONSTRAINT "userNotification_pluginId_fkey" ' +
        'FOREIGN KEY ("pluginId") REFERENCES "plugin" ("id") ON DELETE CASCADE ON UPDATE CASCADE',
      { transaction }
    )

    await utils.sequelize.query(
      'ALTER TABLE "userNotification" DROP CONSTRAINT "userNotification_applicationId_fkey", ' +
        'ADD CONSTRAINT "userNotification_applicationId_fkey" ' +
        'FOREIGN KEY ("applicationId") REFERENCES "application" ("id") ON DELETE CASCADE ON UPDATE CASCADE',
      { transaction }
    )

    await utils.sequelize.query(
      'ALTER TABLE "userNotification" DROP CONSTRAINT "userNotification_videoAbuseId_fkey", ' +
        'ADD CONSTRAINT "userNotification_abuseId_fkey" ' +
        'FOREIGN KEY ("abuseId") REFERENCES "abuse" ("id") ON DELETE CASCADE ON UPDATE CASCADE',
      { transaction }
    )

    await utils.sequelize.query(
      'ALTER TABLE "userNotification" DROP CONSTRAINT "userNotification_videoOwnershipId_fkey", ' +
        'ADD CONSTRAINT "userNotification_changeOwnershipId_fkey" ' +
        'FOREIGN KEY ("changeOwnershipId") REFERENCES "changeOwnership" ("id") ON DELETE CASCADE ON UPDATE CASCADE',
      { transaction }
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
