import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const data = {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    }

    await utils.queryInterface.addColumn('videoCaption', 'filename', data)
  }

  {
    const query = `UPDATE "videoCaption" SET "filename" = s.uuid || '-' || s.language || '.vtt' ` +
    `FROM (` +
    `  SELECT "videoCaption"."id", video.uuid, "videoCaption".language ` +
    `  FROM "videoCaption" INNER JOIN video ON video.id = "videoCaption"."videoId"` +
    `) AS s ` +
    `WHERE "videoCaption".id = s.id`

    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: null
    }

    await utils.queryInterface.changeColumn('videoCaption', 'filename', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
