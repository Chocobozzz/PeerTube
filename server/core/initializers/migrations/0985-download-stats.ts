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

    await utils.queryInterface.renameTable("videoView", "videoStats")

    await utils.queryInterface.addColumn(
      "videoStats",
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

  await utils.queryInterface.removeColumn("videoStats", "downloads", {
    transaction: utils.transaction,
  })

  await utils.queryInterface.renameTable("videoStats", "videoView")
}

export { up, down }
