import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  await utils.sequelize.query(
    `
      UPDATE "oAuthToken"
      SET
        "accessTokenExpiresAt" = NOW(),
        "refreshTokenExpiresAt" = NOW()
      WHERE "accessTokenExpiresAt" > NOW() OR "refreshTokenExpiresAt" > NOW()
    `,
    { transaction }
  )
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
