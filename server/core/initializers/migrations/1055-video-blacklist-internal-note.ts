import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.sequelize.query(
    `ALTER TABLE "videoBlacklist" ` +
      `ADD COLUMN IF NOT EXISTS "internalNote" VARCHAR(300)`,
    { transaction: utils.transaction }
  )
}

async function down (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.sequelize.query(
    `ALTER TABLE "videoBlacklist" DROP COLUMN IF EXISTS "internalNote"`,
    { transaction: utils.transaction }
  )
}

export { down, up }
