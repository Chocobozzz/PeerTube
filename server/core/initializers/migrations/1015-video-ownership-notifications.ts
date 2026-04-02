import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    await utils.sequelize.query(
      `ALTER TABLE "userNotification" ` +
        `ADD COLUMN "videoOwnershipId" INTEGER REFERENCES "videoChangeOwnership" ("id") ON DELETE SET NULL ON UPDATE CASCADE`,
      { transaction }
    )
  }
}

function down () {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
