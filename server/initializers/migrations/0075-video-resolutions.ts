import * as Sequelize from 'sequelize'
import { join } from 'path'
import { CONFIG } from '../../initializers/config'
import { getVideoFileResolution } from '../../helpers/ffmpeg-utils'
import { readdir, rename } from 'fs-extra'

function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const torrentDir = CONFIG.STORAGE.TORRENTS_DIR
  const videoFileDir = CONFIG.STORAGE.VIDEOS_DIR

  return readdir(videoFileDir)
    .then(videoFiles => {
      const tasks: Promise<any>[] = []
      for (const videoFile of videoFiles) {
        const matches = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([a-z0-9]+)/.exec(videoFile)
        if (matches === null) {
          console.log('Invalid video file name %s.', videoFile)
          continue
        }

        const uuid = matches[1]
        const ext = matches[2]

        const p = getVideoFileResolution(join(videoFileDir, videoFile))
          .then(height => {
            const oldTorrentName = uuid + '.torrent'
            const newTorrentName = uuid + '-' + height + '.torrent'
            return rename(join(torrentDir, oldTorrentName), join(torrentDir, newTorrentName)).then(() => height)
          })
          .then(height => {
            const newVideoFileName = uuid + '-' + height + '.' + ext
            return rename(join(videoFileDir, videoFile), join(videoFileDir, newVideoFileName)).then(() => height)
          })
          .then(height => {
            const query = 'UPDATE "VideoFiles" SET "resolution" = ' + height +
                          ' WHERE "videoId" = (SELECT "id" FROM "Videos" WHERE "uuid" = \'' + uuid + '\')'
            return utils.sequelize.query(query)
          })

        tasks.push(p)
      }

      return Promise.all(tasks).then(() => undefined)
    })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
