import { registerTSPaths } from '../../server/helpers/register-ts-paths'
registerTSPaths()

import { initDatabaseModels, sequelizeTypescript } from '../../server/initializers/database'
import * as Sequelize from 'sequelize'
import { join } from 'path'
import { HLS_STREAMING_PLAYLIST_DIRECTORY, STATIC_PATHS, WEBSERVER } from '@server/initializers/constants'
import { pathExists, stat, writeFile } from 'fs-extra'
import { createTorrentPromise } from '@server/helpers/webtorrent'
import { CONFIG } from '@server/initializers/config'
import * as parseTorrent from 'parse-torrent'
import { logger } from '@server/helpers/logger'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  logger.info('Creating torrents and updating database for HSL files.')

  await initDatabaseModels(true)

  const query = 'select "videoFile".id as id, "videoFile".resolution as resolution, "video".uuid as uuid from "videoFile" ' +
    'inner join "videoStreamingPlaylist" ON "videoStreamingPlaylist".id = "videoFile"."videoStreamingPlaylistId" ' +
    'inner join video ON video.id = "videoStreamingPlaylist"."videoId" ' +
    'WHERE video.remote IS FALSE'
  const options = {
    type: Sequelize.QueryTypes.SELECT
  }
  const res = await sequelizeTypescript.query(query, options)

  for (const row of res) {
    const videoFilename = `${row['uuid']}-${row['resolution']}-fragmented.mp4`
    const videoFilePath = join(HLS_STREAMING_PLAYLIST_DIRECTORY, row['uuid'], videoFilename)

    logger.info('Processing %s.', videoFilePath)

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
      urlList: [ WEBSERVER.URL + join(STATIC_PATHS.STREAMING_PLAYLISTS.HLS, row['uuid'], videoFilename) ]
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
      replacements: [ infoHash, size, row['id'] ]
    }
    await sequelizeTypescript.query(queryUpdate, options)
  }
}
