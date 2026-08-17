import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  // No need to update `sitemapContentUpdatedAt`, we'll use `publishedAt` by default
  await utils.sequelize.query(
    `ALTER TABLE "video" ADD COLUMN IF NOT EXISTS "sitemapContentUpdatedAt" TIMESTAMP WITH TIME ZONE`,
    { transaction: utils.transaction }
  )
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
