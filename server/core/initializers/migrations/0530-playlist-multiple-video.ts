import * as Sequelize from 'sequelize'
import { WEBSERVER } from '../constants.js'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    const field = {
      type: Sequelize.STRING,
      allowNull: true
    }
    await utils.queryInterface.changeColumn('videoPlaylistElement', 'url', field)
  }

  {
    await utils.sequelize.query('DROP INDEX IF EXISTS video_playlist_element_video_playlist_id_video_id;')
  }

  {
    const selectPlaylistUUID = 'SELECT "uuid" FROM "videoPlaylist" WHERE "id" = "videoPlaylistElement"."videoPlaylistId"'
    const url = `'${WEBSERVER.URL}' || '/video-playlists/' || (${selectPlaylistUUID}) || '/videos/' || "videoPlaylistElement"."id"`

    const query = `
      UPDATE "videoPlaylistElement" SET "url" = ${url} WHERE id IN (
        SELECT "videoPlaylistElement"."id" FROM "videoPlaylistElement"
        INNER JOIN "videoPlaylist" ON "videoPlaylist".id = "videoPlaylistElement"."videoPlaylistId"
        INNER JOIN account ON account.id = "videoPlaylist"."ownerAccountId"
        INNER JOIN actor ON actor.id = account."actorId"
        WHERE actor."serverId" IS NULL
      )`

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
