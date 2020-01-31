import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const query = `
CREATE TABLE IF NOT EXISTS "thumbnail"
(
  "id"              SERIAL,
  "filename"        VARCHAR(255)             NOT NULL,
  "height"          INTEGER DEFAULT NULL,
  "width"           INTEGER DEFAULT NULL,
  "type"            INTEGER                  NOT NULL,
  "fileUrl"             VARCHAR(255),
  "videoId"         INTEGER REFERENCES "video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "videoPlaylistId" INTEGER REFERENCES "videoPlaylist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt"       TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt"       TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);`
    await utils.sequelize.query(query)
  }

  {
    // All video thumbnails
    const query = 'INSERT INTO "thumbnail" ("filename", "type", "videoId", "height", "width", "createdAt", "updatedAt")' +
      'SELECT uuid || \'.jpg\', 1, id, 110, 200, NOW(), NOW() FROM "video"'
    await utils.sequelize.query(query)
  }

  {
    // All video previews
    const query = 'INSERT INTO "thumbnail" ("filename", "type", "videoId", "height", "width", "createdAt", "updatedAt")' +
      'SELECT uuid || \'.jpg\', 2, id, 315, 560, NOW(), NOW() FROM "video"'
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
