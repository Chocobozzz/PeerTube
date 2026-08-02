import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.queryInterface.addColumn('videoChannel', 'publicEmail', {
    type: Sequelize.STRING(400),
    allowNull: true,
    defaultValue: null
  }, { transaction: utils.transaction })

  // Fill publicEmail using associated user email if emailPublic is true
  await utils.sequelize.query(
    `UPDATE "videoChannel" SET "publicEmail" = "user"."email"
     FROM "account"
     INNER JOIN "user" ON "account"."userId" = "user"."id"
     WHERE "videoChannel"."accountId" = "account"."id"
     AND "user"."emailPublic" = true`,
    { transaction: utils.transaction }
  )

  await utils.queryInterface.removeColumn('user', 'emailPublic', { transaction: utils.transaction })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
