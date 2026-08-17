import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  // Redundant with a new index introduced in the model (auto created at startup)
  await utils.sequelize.query(
    `DROP INDEX IF EXISTS "video_comment_in_reply_to_comment_id"`,
    { transaction }
  )
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
