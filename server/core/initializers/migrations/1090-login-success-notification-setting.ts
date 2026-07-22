import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  await utils.sequelize.query(
    `ALTER TABLE "userNotificationSetting" ADD COLUMN IF NOT EXISTS "newLoginSuccess" INTEGER`,
    { transaction }
  )

  await utils.sequelize.query(
    `UPDATE "userNotificationSetting" SET "newLoginSuccess" = 1 WHERE "newLoginSuccess" IS NULL`,
    { transaction }
  )

  await utils.sequelize.query(
    `ALTER TABLE "userNotificationSetting" ALTER COLUMN "newLoginSuccess" SET NOT NULL`,
    { transaction }
  )
}

function down () {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
