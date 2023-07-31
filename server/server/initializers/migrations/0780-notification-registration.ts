import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    await utils.sequelize.query('DELETE FROM "userNotification" WHERE type = 20 AND "userRegistrationId" IS NULL', { transaction })
  }

  {
    await utils.sequelize.query(
      'ALTER TABLE "userNotification" DROP CONSTRAINT "userNotification_userRegistrationId_fkey", ' +
      'ADD CONSTRAINT "userNotification_userRegistrationId_fkey" ' +
      'FOREIGN KEY ("userRegistrationId") REFERENCES "userRegistration" ("id") ON DELETE CASCADE ON UPDATE CASCADE',
      { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
