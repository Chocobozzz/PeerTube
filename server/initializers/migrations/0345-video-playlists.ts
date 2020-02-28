import * as Sequelize from 'sequelize'
import { VideoPlaylistPrivacy, VideoPlaylistType } from '../../../shared/models/videos'
import { v4 as uuidv4 } from 'uuid'
import { WEBSERVER } from '../constants'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const transaction = utils.transaction

  {
    const query = `
CREATE TABLE IF NOT EXISTS "videoPlaylist"
(
  "id"             SERIAL,
  "name"           VARCHAR(255)             NOT NULL,
  "description"    VARCHAR(255),
  "privacy"        INTEGER                  NOT NULL,
  "url"            VARCHAR(2000)            NOT NULL,
  "uuid"           UUID                     NOT NULL,
  "type"           INTEGER                  NOT NULL DEFAULT 1,
  "ownerAccountId" INTEGER                  NOT NULL REFERENCES "account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "videoChannelId" INTEGER REFERENCES "videoChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt"      TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);`
    await utils.sequelize.query(query, { transaction })
  }

  {
    const query = `
CREATE TABLE IF NOT EXISTS "videoPlaylistElement"
(
  "id"              SERIAL,
  "url"             VARCHAR(2000)            NOT NULL,
  "position"        INTEGER                  NOT NULL DEFAULT 1,
  "startTimestamp"  INTEGER,
  "stopTimestamp"   INTEGER,
  "videoPlaylistId" INTEGER                  NOT NULL REFERENCES "videoPlaylist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "videoId"         INTEGER                  NOT NULL REFERENCES "video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt"       TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt"       TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);`

    await utils.sequelize.query(query, { transaction })
  }

  {
    const userQuery = 'SELECT "username" FROM "user";'

    const options = { transaction, type: Sequelize.QueryTypes.SELECT as Sequelize.QueryTypes.SELECT }
    const userResult = await utils.sequelize.query<{ username: string }>(userQuery, options)
    const usernames = userResult.map(r => r.username)

    for (const username of usernames) {
      const uuid = uuidv4()

      const baseUrl = WEBSERVER.URL + '/video-playlists/' + uuid
      const query = `
 INSERT INTO "videoPlaylist" ("url", "uuid", "name", "privacy", "type", "ownerAccountId", "createdAt", "updatedAt")
 SELECT '${baseUrl}' AS "url",
         '${uuid}' AS "uuid",
         'Watch later' AS "name",
         ${VideoPlaylistPrivacy.PRIVATE} AS "privacy",
         ${VideoPlaylistType.WATCH_LATER} AS "type",
         "account"."id" AS "ownerAccountId",
         NOW() as "createdAt",
         NOW() as "updatedAt"
 FROM "user" INNER JOIN "account" ON "user"."id" = "account"."userId"
 WHERE "user"."username" = '${username}'`

      await utils.sequelize.query(query, { transaction })
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
