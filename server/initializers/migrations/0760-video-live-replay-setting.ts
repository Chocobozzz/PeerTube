import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    const query = `
    CREATE TABLE IF NOT EXISTS "videoLiveReplaySetting" (
      "id"   SERIAL ,
      "privacy" INTEGER NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      PRIMARY KEY ("id")
      );
    `

    await utils.sequelize.query(query, { transaction : utils.transaction })
  }

  {
    await utils.queryInterface.addColumn('videoLive', 'replaySettingId', {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: true,
      references: {
        model: 'videoLiveReplaySetting',
        key: 'id'
      },
      onDelete: 'SET NULL'
    }, { transaction: utils.transaction })
  }

  {
    await utils.queryInterface.addColumn('videoLiveSession', 'replaySettingId', {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: true,
      references: {
        model: 'videoLiveReplaySetting',
        key: 'id'
      },
      onDelete: 'SET NULL'
    }, { transaction: utils.transaction })
  }

  {
    const query = `
    SELECT live."id", v."privacy"
    FROM "videoLive" live
    INNER JOIN "video" v ON live."videoId" = v."id"
    WHERE live."saveReplay" = true
    `

    const videoLives = await utils.sequelize.query<{ id: number, privacy: number }>(
      query,
      { type: Sequelize.QueryTypes.SELECT, transaction: utils.transaction }
    )

    for (const videoLive of videoLives) {
      const query = `
      WITH new_replay_setting AS (
        INSERT INTO "videoLiveReplaySetting" ("privacy", "createdAt", "updatedAt")
        VALUES (:privacy, NOW(), NOW())
        RETURNING id
        )
      UPDATE "videoLive" SET "replaySettingId" = (SELECT id FROM new_replay_setting)
      WHERE "id" = :id
      `

      const options = {
        replacements: { privacy: videoLive.privacy, id: videoLive.id },
        type: Sequelize.QueryTypes.UPDATE,
        transaction: utils.transaction
      }

      await utils.sequelize.query(query, options)
    }
  }

  {
    const query = `
    SELECT session."id", v."privacy"
    FROM "videoLiveSession" session
    INNER JOIN "video" v ON session."liveVideoId" = v."id"
    WHERE session."saveReplay" = true
      AND session."liveVideoId" IS NOT NULL;
    `

    const videoLiveSessions = await utils.sequelize.query<{ id: number, privacy: number }>(
      query,
      { type: Sequelize.QueryTypes.SELECT, transaction: utils.transaction }
    )

    for (const videoLive of videoLiveSessions) {
      const query = `
      WITH new_replay_setting AS (
        INSERT INTO "videoLiveReplaySetting" ("privacy", "createdAt", "updatedAt")
        VALUES (:privacy, NOW(), NOW())
        RETURNING id
        )
      UPDATE "videoLiveSession" SET "replaySettingId" = (SELECT id FROM new_replay_setting)
      WHERE "id" = :id
      `

      const options = {
        replacements: { privacy: videoLive.privacy, id: videoLive.id },
        type: Sequelize.QueryTypes.UPDATE,
        transaction: utils.transaction
      }

      await utils.sequelize.query(query, options)
    }
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
