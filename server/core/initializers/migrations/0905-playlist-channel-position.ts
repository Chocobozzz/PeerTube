import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    await utils.queryInterface.addColumn('videoPlaylist', 'videoChannelPosition', {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: true
    }, { transaction })
  }

  {
    await utils.sequelize.query(
      `UPDATE "videoPlaylist" SET "videoChannelPosition" = tmp.position FROM (` +
        `SELECT tmp.*, ROW_NUMBER () ` +
        `OVER (PARTITION BY "videoChannelId" ORDER BY "updatedAt" DESC) AS "position" from "videoPlaylist" "tmp" ` +
        `WHERE "tmp"."videoChannelPosition" IS NULL AND "tmp"."videoChannelId" IS NOT NULL` +
        `) tmp ` +
        `WHERE "videoPlaylist"."id" = tmp.id`,
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
