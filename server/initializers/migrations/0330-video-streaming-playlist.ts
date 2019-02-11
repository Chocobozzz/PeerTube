import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize
}): Promise<void> {

  {
    const query = `
  CREATE TABLE IF NOT EXISTS "videoStreamingPlaylist"
(
  "id"                       SERIAL,
  "type"                     INTEGER                  NOT NULL,
  "playlistUrl"              VARCHAR(2000)            NOT NULL,
  "p2pMediaLoaderInfohashes" VARCHAR(255)[]           NOT NULL,
  "segmentsSha256Url"        VARCHAR(255)             NOT NULL,
  "videoId"                  INTEGER                  NOT NULL REFERENCES "video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt"                TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt"                TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);`
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    }

    await utils.queryInterface.changeColumn('videoRedundancy', 'videoFileId', data)
  }

  {
    const query = 'ALTER TABLE "videoRedundancy" ADD COLUMN "videoStreamingPlaylistId" INTEGER NULL ' +
      'REFERENCES "videoStreamingPlaylist" ("id") ON DELETE CASCADE ON UPDATE CASCADE'

    await utils.sequelize.query(query)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
