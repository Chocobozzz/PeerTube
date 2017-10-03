import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'
import { join } from 'path'

import { readdirPromise, renamePromise } from '../../helpers/core-utils'
import { CONFIG } from '../../initializers/constants'

function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize,
  db: any
}): Promise<void> {
  const torrentDir = CONFIG.STORAGE.TORRENTS_DIR
  const videoFileDir = CONFIG.STORAGE.VIDEOS_DIR

  return readdirPromise(torrentDir)
    .then(torrentFiles => {
      const tasks: Promise<any>[] = []
      for (const torrentFile of torrentFiles) {
        const matches = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.torrent/.exec(torrentFile)
        if (matches === null) {
          console.log('Invalid torrent file name %s.', torrentFile)
          continue
        }

        const newTorrentName = matches[1] + '-original.torrent'
        const p = renamePromise(join(torrentDir, torrentFile), join(torrentDir, newTorrentName))
        tasks.push(p)
      }

      return Promise.all(tasks)
    })
    .then(() => {
      return readdirPromise(videoFileDir)
    })
    .then(videoFiles => {
      const tasks: Promise<any>[] = []
      for (const videoFile of videoFiles) {
        const matches = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([a-z0-9]+)/.exec(videoFile)
        if (matches === null) {
          console.log('Invalid video file name %s.', videoFile)
          continue
        }

        const newVideoFileName = matches[1] + '-original.' + matches[2]
        const p = renamePromise(join(videoFileDir, videoFile), join(videoFileDir, newVideoFileName))
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
