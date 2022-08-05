import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const { transaction } = utils

  {
    const data = {
      type: Sequelize.BOOLEAN,
      defaultValue: null,
      allowNull: true
    }
    await utils.queryInterface.addColumn('videoLiveSession', 'endingProcessed', data, { transaction })
    await utils.queryInterface.addColumn('videoLiveSession', 'saveReplay', data, { transaction })
  }

  {
    const query = `UPDATE "videoLiveSession" SET "saveReplay" = (
      SELECT "videoLive"."saveReplay" FROM "videoLive" WHERE "videoLive"."videoId" = "videoLiveSession"."liveVideoId"
    ) WHERE "videoLiveSession"."liveVideoId" IS NOT NULL`
    await utils.sequelize.query(query, { transaction })
  }

  {
    const query = `UPDATE "videoLiveSession" SET "saveReplay" = FALSE WHERE "saveReplay" IS NULL`
    await utils.sequelize.query(query, { transaction })
  }

  {
    const query = `UPDATE "videoLiveSession" SET "endingProcessed" = TRUE`
    await utils.sequelize.query(query, { transaction })
  }

  {
    const data = {
      type: Sequelize.BOOLEAN,
      defaultValue: null,
      allowNull: false
    }
    await utils.queryInterface.changeColumn('videoLiveSession', 'endingProcessed', data, { transaction })
    await utils.queryInterface.changeColumn('videoLiveSession', 'saveReplay', data, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
