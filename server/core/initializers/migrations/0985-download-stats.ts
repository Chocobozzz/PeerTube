import * as Sequelize from "sequelize";

async function up(utils: {
  transaction: Sequelize.Transaction;
  queryInterface: Sequelize.QueryInterface;
  sequelize: Sequelize.Sequelize;
}): Promise < void > {
  {
    const query = `
      CREATE TABLE IF NOT EXISTS "videoDownload" (
        "id"   SERIAL,
        "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "endDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "downloads" INTEGER NOT NULL,
        "videoId" INTEGER NOT NULL REFERENCES "video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        PRIMARY KEY ("id")
      );
    `;

    await utils.sequelize.query(query, {
      transaction: utils.transaction,
    });

    await utils.queryInterface.addColumn(
      "video",
      "downloads", {
        type: Sequelize.NUMBER,
        defaultValue: 0,
      }, {
        transaction: utils.transaction,
      },
    );
  }
}

async function down(utils: {
  transaction: Sequelize.Transaction;
  queryInterface: Sequelize.QueryInterface;
  sequelize: Sequelize.Sequelize;
}): Promise < void > {
  const query = `DROP TABLE "videoDownload";`;

  await utils.sequelize.query(query, {
    transaction: utils.transaction,
  });

  await utils.queryInterface.removeColumn("video", "downloads", {
    transaction: utils.transaction,
  });
}

export { up, down };
