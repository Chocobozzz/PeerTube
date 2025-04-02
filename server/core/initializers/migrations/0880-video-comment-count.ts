import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    await utils.queryInterface.addColumn('video', 'comments', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    }, { transaction })
  }

  {
    const query = 'UPDATE "video" SET "comments" = (SELECT COUNT(*) FROM "videoComment" WHERE "videoComment"."videoId" = "video"."id")'
    await utils.sequelize.query(query, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
