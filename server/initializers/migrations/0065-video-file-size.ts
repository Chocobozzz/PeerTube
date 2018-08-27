import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'
import { stat } from 'fs-extra'
import { VideoModel } from '../../models/video/video'

function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize,
  db: any
}): Promise<void> {
  return utils.db.Video.listOwnedAndPopulateAuthorAndTags()
    .then((videos: VideoModel[]) => {
      const tasks: Promise<any>[] = []

      videos.forEach(video => {
        video.VideoFiles.forEach(videoFile => {
          const p = new Promise((res, rej) => {
            stat(video.getVideoFilePath(videoFile), (err, stats) => {
              if (err) return rej(err)

              videoFile.size = stats.size
              videoFile.save().then(res).catch(rej)
            })
          })

          tasks.push(p)
        })
      })

      return tasks
    })
    .then((tasks: Promise<any>[]) => {
      return Promise.all(tasks)
    })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
