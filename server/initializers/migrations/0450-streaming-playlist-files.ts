import * as Sequelize from 'sequelize'
import { join } from 'path'
import { HLS_STREAMING_PLAYLIST_DIRECTORY, WEBSERVER } from '@server/initializers/constants'
import { CONFIG } from '@server/initializers/config'
import { pathExists, stat, writeFile } from 'fs-extra'
import * as parseTorrent from 'parse-torrent'
import { createTorrentPromise } from '@server/helpers/webtorrent'

async function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize,
  db: any
}): Promise<void> {
  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'videoStreamingPlaylist',
        key: 'id'
      },
      onDelete: 'CASCADE'
    }

    await utils.queryInterface.addColumn('videoFile', 'videoStreamingPlaylistId', data)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: true
    }

    await utils.queryInterface.changeColumn('videoFile', 'videoId', data)
  }

  {
    await utils.queryInterface.removeIndex('videoFile', 'video_file_video_id_resolution_fps')
  }

  {
    const query = 'insert into "videoFile" ' +
      '(resolution, size, "infoHash", "videoId", "createdAt", "updatedAt", fps, extname, "videoStreamingPlaylistId")' +
      '(SELECT "videoFile".resolution, "videoFile".size, \'fake\', NULL, "videoFile"."createdAt", "videoFile"."updatedAt", "videoFile"."fps", ' +
      '"videoFile".extname, "videoStreamingPlaylist".id FROM "videoStreamingPlaylist" ' +
      'inner join video ON video.id = "videoStreamingPlaylist"."videoId" inner join "videoFile" ON "videoFile"."videoId" = video.id)'

    await utils.sequelize.query(query, { transaction: utils.transaction })
  }

  {
    const query = 'select "videoFile".id as id, "videoFile".resolution as resolution, "video".uuid as uuid from "videoFile" ' +
      'inner join "videoStreamingPlaylist" ON "videoStreamingPlaylist".id = "videoFile"."videoStreamingPlaylistId" ' +
      'inner join video ON video.id = "videoStreamingPlaylist"."videoId" ' +
      'WHERE video.remote IS FALSE'
    const options = {
      type: Sequelize.QueryTypes.SELECT,
      transaction: utils.transaction
    }
    const res = await utils.sequelize.query(query, options)

    for (const row of res) {
      const videoFilename = `${row['uuid']}-${row['resolution']}-fragmented.mp4`
      const videoFilePath = join(HLS_STREAMING_PLAYLIST_DIRECTORY, row['uuid'], videoFilename)

      if (!await pathExists(videoFilePath)) {
        console.warn('Cannot generate torrent of %s: file does not exist.', videoFilePath)
        continue
      }

      const createTorrentOptions = {
        // Keep the extname, it's used by the client to stream the file inside a web browser
        name: `video ${row['uuid']}`,
        createdBy: 'PeerTube',
        announceList: [
          [ WEBSERVER.WS + '://' + WEBSERVER.HOSTNAME + ':' + WEBSERVER.PORT + '/tracker/socket' ],
          [ WEBSERVER.URL + '/tracker/announce' ]
        ],
        urlList: [ WEBSERVER.URL + join(HLS_STREAMING_PLAYLIST_DIRECTORY, row['uuid'], videoFilename) ]
      }
      const torrent = await createTorrentPromise(videoFilePath, createTorrentOptions)

      const torrentName = `${row['uuid']}-${row['resolution']}-hls.torrent`
      const filePath = join(CONFIG.STORAGE.TORRENTS_DIR, torrentName)

      await writeFile(filePath, torrent)

      const parsedTorrent = parseTorrent(torrent)
      const infoHash = parsedTorrent.infoHash

      const stats = await stat(videoFilePath)
      const size = stats.size

      const queryUpdate = 'UPDATE "videoFile" SET "infoHash" = ?, "size" = ? WHERE id = ?'

      const options = {
        type: Sequelize.QueryTypes.UPDATE,
        replacements: [ infoHash, size, row['id'] ],
        transaction: utils.transaction
      }
      await utils.sequelize.query(queryUpdate, options)

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
