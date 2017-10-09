import * as express from 'express'
import * as Promise from 'bluebird'
import * as multer from 'multer'
import { extname, join } from 'path'

import { database as db } from '../../../initializers/database'
import {
  CONFIG,
  REQUEST_VIDEO_QADU_TYPES,
  REQUEST_VIDEO_EVENT_TYPES,
  VIDEO_CATEGORIES,
  VIDEO_LICENCES,
  VIDEO_LANGUAGES
} from '../../../initializers'
import {
  addEventToRemoteVideo,
  quickAndDirtyUpdateVideoToFriends,
  addVideoToFriends,
  updateVideoToFriends,
  JobScheduler
} from '../../../lib'
import {
  authenticate,
  paginationValidator,
  videosSortValidator,
  setVideosSort,
  setPagination,
  setVideosSearch,
  videosUpdateValidator,
  videosSearchValidator,
  videosAddValidator,
  videosGetValidator,
  videosRemoveValidator
} from '../../../middlewares'
import {
  logger,
  retryTransactionWrapper,
  generateRandomString,
  getFormattedObjects,
  renamePromise,
  getVideoFileHeight
} from '../../../helpers'
import { TagInstance, VideoInstance } from '../../../models'
import { VideoCreate, VideoUpdate } from '../../../../shared'

import { abuseVideoRouter } from './abuse'
import { blacklistRouter } from './blacklist'
import { rateVideoRouter } from './rate'

const videosRouter = express.Router()

// multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CONFIG.STORAGE.VIDEOS_DIR)
  },

  filename: (req, file, cb) => {
    let extension = ''
    if (file.mimetype === 'video/webm') extension = 'webm'
    else if (file.mimetype === 'video/mp4') extension = 'mp4'
    else if (file.mimetype === 'video/ogg') extension = 'ogv'
    generateRandomString(16)
      .then(randomString => {
        cb(null, randomString + '.' + extension)
      })
      .catch(err => {
        logger.error('Cannot generate random string for file name.', err)
        throw err
      })
  }
})

const reqFiles = multer({ storage: storage }).fields([{ name: 'videofile', maxCount: 1 }])

videosRouter.use('/', abuseVideoRouter)
videosRouter.use('/', blacklistRouter)
videosRouter.use('/', rateVideoRouter)

videosRouter.get('/categories', listVideoCategories)
videosRouter.get('/licences', listVideoLicences)
videosRouter.get('/languages', listVideoLanguages)

videosRouter.get('/',
  paginationValidator,
  videosSortValidator,
  setVideosSort,
  setPagination,
  listVideos
)
videosRouter.put('/:id',
  authenticate,
  videosUpdateValidator,
  updateVideoRetryWrapper
)
videosRouter.post('/upload',
  authenticate,
  reqFiles,
  videosAddValidator,
  addVideoRetryWrapper
)
videosRouter.get('/:id',
  videosGetValidator,
  getVideo
)

videosRouter.delete('/:id',
  authenticate,
  videosRemoveValidator,
  removeVideoRetryWrapper
)

videosRouter.get('/search/:value',
  videosSearchValidator,
  paginationValidator,
  videosSortValidator,
  setVideosSort,
  setPagination,
  setVideosSearch,
  searchVideos
)

// ---------------------------------------------------------------------------

export {
  videosRouter
}

// ---------------------------------------------------------------------------

function listVideoCategories (req: express.Request, res: express.Response) {
  res.json(VIDEO_CATEGORIES)
}

function listVideoLicences (req: express.Request, res: express.Response) {
  res.json(VIDEO_LICENCES)
}

function listVideoLanguages (req: express.Request, res: express.Response) {
  res.json(VIDEO_LANGUAGES)
}

// Wrapper to video add that retry the function if there is a database error
// We need this because we run the transaction in SERIALIZABLE isolation that can fail
function addVideoRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res, req.files['videofile'][0] ],
    errorMessage: 'Cannot insert the video with many retries.'
  }

  retryTransactionWrapper(addVideo, options)
    .then(() => {
      // TODO : include Location of the new video -> 201
      res.type('json').status(204).end()
    })
    .catch(err => next(err))
}

function addVideo (req: express.Request, res: express.Response, videoPhysicalFile: Express.Multer.File) {
  const videoInfo: VideoCreate = req.body
  let videoUUID = ''

  return db.sequelize.transaction(t => {
    const user = res.locals.oauth.token.User

    const name = user.username
    // null because it is OUR pod
    const podId = null
    const userId = user.id

    return db.Author.findOrCreateAuthor(name, podId, userId, t)
      .then(author => {
        const tags = videoInfo.tags
        if (!tags) return { author, tagInstances: undefined }

        return db.Tag.findOrCreateTags(tags, t).then(tagInstances => ({ author, tagInstances }))
      })
      .then(({ author, tagInstances }) => {
        const videoData = {
          name: videoInfo.name,
          remote: false,
          extname: extname(videoPhysicalFile.filename),
          category: videoInfo.category,
          licence: videoInfo.licence,
          language: videoInfo.language,
          nsfw: videoInfo.nsfw,
          description: videoInfo.description,
          duration: videoPhysicalFile['duration'], // duration was added by a previous middleware
          authorId: author.id
        }

        const video = db.Video.build(videoData)
        return { author, tagInstances, video }
      })
      .then(({ author, tagInstances, video }) => {
        const videoFilePath = join(CONFIG.STORAGE.VIDEOS_DIR, videoPhysicalFile.filename)
        return getVideoFileHeight(videoFilePath)
          .then(height => ({ author, tagInstances, video, videoFileHeight: height }))
      })
      .then(({ author, tagInstances, video, videoFileHeight }) => {
        const videoFileData = {
          extname: extname(videoPhysicalFile.filename),
          resolution: videoFileHeight,
          size: videoPhysicalFile.size
        }

        const videoFile = db.VideoFile.build(videoFileData)
        return { author, tagInstances, video, videoFile }
      })
      .then(({ author, tagInstances, video, videoFile }) => {
        const videoDir = CONFIG.STORAGE.VIDEOS_DIR
        const source = join(videoDir, videoPhysicalFile.filename)
        const destination = join(videoDir, video.getVideoFilename(videoFile))

        return renamePromise(source, destination)
          .then(() => {
            // This is important in case if there is another attempt in the retry process
            videoPhysicalFile.filename = video.getVideoFilename(videoFile)
            return { author, tagInstances, video, videoFile }
          })
      })
      .then(({ author, tagInstances, video, videoFile }) => {
        const tasks = []

        tasks.push(
          video.createTorrentAndSetInfoHash(videoFile),
          video.createThumbnail(videoFile),
          video.createPreview(videoFile)
        )

        if (CONFIG.TRANSCODING.ENABLED === true) {
          // Put uuid because we don't have id auto incremented for now
          const dataInput = {
            videoUUID: video.uuid
          }

          tasks.push(
            JobScheduler.Instance.createJob(t, 'videoFileOptimizer', dataInput)
          )
        }

        return Promise.all(tasks).then(() => ({ author, tagInstances, video, videoFile }))
      })
      .then(({ author, tagInstances, video, videoFile }) => {
        const options = { transaction: t }

        return video.save(options)
          .then(videoCreated => {
            // Do not forget to add Author information to the created video
            videoCreated.Author = author
            videoUUID = videoCreated.uuid

            return { tagInstances, video: videoCreated, videoFile }
          })
      })
      .then(({ tagInstances, video, videoFile }) => {
        const options = { transaction: t }
        videoFile.videoId = video.id

        return videoFile.save(options)
          .then(() => video.VideoFiles = [ videoFile ])
          .then(() => ({ tagInstances, video }))
      })
      .then(({ tagInstances, video }) => {
        if (!tagInstances) return video

        const options = { transaction: t }
        return video.setTags(tagInstances, options)
          .then(() => {
            video.Tags = tagInstances
            return video
          })
      })
      .then(video => {
        // Let transcoding job send the video to friends because the video file extension might change
        if (CONFIG.TRANSCODING.ENABLED === true) return undefined

        return video.toAddRemoteJSON()
          .then(remoteVideo => {
            // Now we'll add the video's meta data to our friends
            return addVideoToFriends(remoteVideo, t)
          })
      })
  })
  .then(() => logger.info('Video with name %s and uuid %s created.', videoInfo.name, videoUUID))
  .catch((err: Error) => {
    logger.debug('Cannot insert the video.', err)
    throw err
  })
}

function updateVideoRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot update the video with many retries.'
  }

  retryTransactionWrapper(updateVideo, options)
    .then(() => {
      return res.type('json').status(204).end()
    })
    .catch(err => next(err))
}

function updateVideo (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.video
  const videoFieldsSave = videoInstance.toJSON()
  const videoInfoToUpdate: VideoUpdate = req.body

  return db.sequelize.transaction(t => {
    let tagsPromise: Promise<TagInstance[]>
    if (!videoInfoToUpdate.tags) {
      tagsPromise = Promise.resolve(null)
    } else {
      tagsPromise = db.Tag.findOrCreateTags(videoInfoToUpdate.tags, t)
    }

    return tagsPromise
      .then(tagInstances => {
        const options = {
          transaction: t
        }

        if (videoInfoToUpdate.name !== undefined) videoInstance.set('name', videoInfoToUpdate.name)
        if (videoInfoToUpdate.category !== undefined) videoInstance.set('category', videoInfoToUpdate.category)
        if (videoInfoToUpdate.licence !== undefined) videoInstance.set('licence', videoInfoToUpdate.licence)
        if (videoInfoToUpdate.language !== undefined) videoInstance.set('language', videoInfoToUpdate.language)
        if (videoInfoToUpdate.nsfw !== undefined) videoInstance.set('nsfw', videoInfoToUpdate.nsfw)
        if (videoInfoToUpdate.description !== undefined) videoInstance.set('description', videoInfoToUpdate.description)

        return videoInstance.save(options).then(() => tagInstances)
      })
      .then(tagInstances => {
        if (!tagInstances) return

        const options = { transaction: t }
        return videoInstance.setTags(tagInstances, options)
          .then(() => {
            videoInstance.Tags = tagInstances

            return
          })
      })
      .then(() => {
        const json = videoInstance.toUpdateRemoteJSON()

        // Now we'll update the video's meta data to our friends
        return updateVideoToFriends(json, t)
      })
  })
  .then(() => {
    logger.info('Video with name %s and uuid %s updated.', videoInstance.name, videoInstance.uuid)
  })
  .catch(err => {
    logger.debug('Cannot update the video.', err)

    // Force fields we want to update
    // If the transaction is retried, sequelize will think the object has not changed
    // So it will skip the SQL request, even if the last one was ROLLBACKed!
    Object.keys(videoFieldsSave).forEach(key => {
      const value = videoFieldsSave[key]
      videoInstance.set(key, value)
    })

    throw err
  })
}

function getVideo (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.video

  if (videoInstance.isOwned()) {
    // The increment is done directly in the database, not using the instance value
    videoInstance.increment('views')
      .then(() => {
        // FIXME: make a real view system
        // For example, only add a view when a user watch a video during 30s etc
        const qaduParams = {
          videoId: videoInstance.id,
          type: REQUEST_VIDEO_QADU_TYPES.VIEWS
        }
        return quickAndDirtyUpdateVideoToFriends(qaduParams)
      })
      .catch(err => logger.error('Cannot add view to video %d.', videoInstance.id, err))
  } else {
    // Just send the event to our friends
    const eventParams = {
      videoId: videoInstance.id,
      type: REQUEST_VIDEO_EVENT_TYPES.VIEWS
    }
    addEventToRemoteVideo(eventParams)
  }

  // Do not wait the view system
  res.json(videoInstance.toFormattedJSON())
}

function listVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.Video.listForApi(req.query.start, req.query.count, req.query.sort)
    .then(result => res.json(getFormattedObjects(result.data, result.total)))
    .catch(err => next(err))
}

function removeVideoRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot remove the video with many retries.'
  }

  retryTransactionWrapper(removeVideo, options)
    .then(() => {
      return res.type('json').status(204).end()
    })
    .catch(err => next(err))
}

function removeVideo (req: express.Request, res: express.Response) {
  const videoInstance: VideoInstance = res.locals.video

  return db.sequelize.transaction(t => {
    return videoInstance.destroy({ transaction: t })
  })
  .then(() => {
    logger.info('Video with name %s and uuid %s deleted.', videoInstance.name, videoInstance.uuid)
  })
  .catch(err => {
    logger.error('Errors when removed the video.', err)
    throw err
  })
}

function searchVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.Video.searchAndPopulateAuthorAndPodAndTags(req.params.value, req.query.field, req.query.start, req.query.count, req.query.sort)
    .then(result => res.json(getFormattedObjects(result.data, result.total)))
    .catch(err => next(err))
}
