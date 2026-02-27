import * as Sequelize from "sequelize"

async function up(utils: {
  transaction: Sequelize.Transaction;
  queryInterface: Sequelize.QueryInterface;
  sequelize: Sequelize.Sequelize;
}): Promise < void > {
  {
    await utils.queryInterface.addColumn(
      "video",
      "downloads", {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      }, {
        transaction: utils.transaction,
      },
    )

    await utils.queryInterface.addColumn(
      "videoView",
      "downloads", {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      }, {
        transaction: utils.transaction,
      },
    )
  }
}

async function down(utils: {
  transaction: Sequelize.Transaction;
  queryInterface: Sequelize.QueryInterface;
  sequelize: Sequelize.Sequelize;
}): Promise < void > {
  await utils.queryInterface.removeColumn("video", "downloads", {
    transaction: utils.transaction,
  })
  await utils.queryInterface.removeColumn("videoView", "downloads", {
    transaction: utils.transaction,
  })
}

export { up, down }
