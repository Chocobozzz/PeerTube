import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    const query = 'DELETE FROM "videoShare" s1 ' +
      'USING (SELECT MIN(id) as id, "actorId", "videoId" FROM "videoShare" GROUP BY "actorId", "videoId" HAVING COUNT(*) > 1) s2 ' +
      'WHERE s1."actorId" = s2."actorId" AND s1."videoId" = s2."videoId" AND s1.id <> s2.id'
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('videoShare', 'url', data)

    const query = `UPDATE "videoShare" SET "url" = (SELECT "url" FROM "video" WHERE "id" = "videoId") || '/announces/' || "actorId"`
    await utils.sequelize.query(query)

    data.allowNull = false
    await utils.queryInterface.changeColumn('videoShare', 'url', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
