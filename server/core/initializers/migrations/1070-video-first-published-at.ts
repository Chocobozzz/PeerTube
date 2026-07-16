import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.queryInterface.addColumn('video', 'firstPublishedAt', {
    type: Sequelize.DATE,
    allowNull: true,
    defaultValue: null
  }, { transaction: utils.transaction })

  // Backfill firstPublishedAt for videos that have already been published (state = 1 => PUBLISHED)
  await utils.sequelize.query(
    `UPDATE "video" SET "firstPublishedAt" = "publishedAt" WHERE "state" = 1 AND "firstPublishedAt" IS NULL`,
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
