import * as express from 'express'
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
  JobScheduler,
  fetchRemoteDescription
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
  videosRemoveValidator,
  asyncMiddleware
} from '../../../middlewares'
import {
  logger,
  retryTransactionWrapper,
  generateRandomString,
  getFormattedObjects,
  renamePromise,
  getVideoFileHeight,
  resetSequelizeInstance
} from '../../../helpers'
import { VideoInstance } from '../../../models'
import { VideoCreate, VideoUpdate } from '../../../../shared'

import { abuseVideoRouter } from './abuse'
import { blacklistRouter } from './blacklist'
import { rateVideoRouter } from './rate'
import { videoChannelRouter } from './channel'

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
videosRouter.use('/', videoChannelRouter)

videosRouter.get('/categories', listVideoCategories)
videosRouter.get('/licences', listVideoLicences)
videosRouter.get('/languages', listVideoLanguages)

videosRouter.get('/',
  paginationValidator,
  videosSortValidator,
  setVideosSort,
  setPagination,
  asyncMiddleware(listVideos)
)
videosRouter.put('/:id',
  authenticate,
  videosUpdateValidator,
  asyncMiddleware(updateVideoRetryWrapper)
)
videosRouter.post('/upload',
  authenticate,
  reqFiles,
  videosAddValidator,
  asyncMiddleware(addVideoRetryWrapper)
)

videosRouter.get('/:id/description',
  videosGetValidator,
  asyncMiddleware(getVideoDescription)
)
videosRouter.get('/:id',
  videosGetValidator,
  getVideo
)

videosRouter.delete('/:id',
  authenticate,
  videosRemoveValidator,
  asyncMiddleware(removeVideoRetryWrapper)
)

videosRouter.get('/search/:value',
  videosSearchValidator,
  paginationValidator,
  videosSortValidator,
  setVideosSort,
  setPagination,
  setVideosSearch,
  asyncMiddleware(searchVideos)
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
async function addVideoRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res, req.files['videofile'][0] ],
    errorMessage: 'Cannot insert the video with many retries.'
  }

  await retryTransactionWrapper(addVideo, options)

  // TODO : include Location of the new video -> 201
  res.type('json').status(204).end()
}

async function addVideo (req: express.Request, res: express.Response, videoPhysicalFile: Express.Multer.File) {
  const videoInfo: VideoCreate = req.body
  let videoUUID = ''

  await db.sequelize.transaction(async t => {
    const sequelizeOptions = { transaction: t }

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
      channelId: res.locals.videoChannel.id
    }
    const video = db.Video.build(videoData)

    const videoFilePath = join(CONFIG.STORAGE.VIDEOS_DIR, videoPhysicalFile.filename)
    const videoFileHeight = await getVideoFileHeight(videoFilePath)

    const videoFileData = {
      extname: extname(videoPhysicalFile.filename),
      resolution: videoFileHeight,
      size: videoPhysicalFile.size
    }
    const videoFile = db.VideoFile.build(videoFileData)
    const videoDir = CONFIG.STORAGE.VIDEOS_DIR
    const source = join(videoDir, videoPhysicalFile.filename)
    const destination = join(videoDir, video.getVideoFilename(videoFile))

    await renamePromise(source, destination)
    // This is important in case if there is another attempt in the retry process
    videoPhysicalFile.filename = video.getVideoFilename(videoFile)

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
    await Promise.all(tasks)

    const videoCreated = await video.save(sequelizeOptions)
    // Do not forget to add video channel information to the created video
    videoCreated.VideoChannel = res.locals.videoChannel
    videoUUID = videoCreated.uuid

    videoFile.videoId = video.id

    await videoFile.save(sequelizeOptions)
    video.VideoFiles = [videoFile]

    if (videoInfo.tags) {
      const tagInstances = await db.Tag.findOrCreateTags(videoInfo.tags, t)

      await video.setTags(tagInstances, sequelizeOptions)
      video.Tags = tagInstances
    }

    // Let transcoding job send the video to friends because the video file extension might change
    if (CONFIG.TRANSCODING.ENABLED === true) return undefined

    const remoteVideo = await video.toAddRemoteJSON()
    // Now we'll add the video's meta data to our friends
    return addVideoToFriends(remoteVideo, t)
  })

  logger.info('Video with name %s and uuid %s created.', videoInfo.name, videoUUID)
}

async function updateVideoRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot update the video with many retries.'
  }

  await retryTransactionWrapper(updateVideo, options)

  return res.type('json').status(204).end()
}

async function updateVideo (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.video
  const videoFieldsSave = videoInstance.toJSON()
  const videoInfoToUpdate: VideoUpdate = req.body

  try {
    await db.sequelize.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }

      if (videoInfoToUpdate.name !== undefined) videoInstance.set('name', videoInfoToUpdate.name)
      if (videoInfoToUpdate.category !== undefined) videoInstance.set('category', videoInfoToUpdate.category)
      if (videoInfoToUpdate.licence !== undefined) videoInstance.set('licence', videoInfoToUpdate.licence)
      if (videoInfoToUpdate.language !== undefined) videoInstance.set('language', videoInfoToUpdate.language)
      if (videoInfoToUpdate.nsfw !== undefined) videoInstance.set('nsfw', videoInfoToUpdate.nsfw)
      if (videoInfoToUpdate.description !== undefined) videoInstance.set('description', videoInfoToUpdate.description)

      await videoInstance.save(sequelizeOptions)

      if (videoInfoToUpdate.tags) {
        const tagInstances = await db.Tag.findOrCreateTags(videoInfoToUpdate.tags, t)

        await videoInstance.setTags(tagInstances, sequelizeOptions)
        videoInstance.Tags = tagInstances
      }

      const json = videoInstance.toUpdateRemoteJSON()

      // Now we'll update the video's meta data to our friends
      return updateVideoToFriends(json, t)
    })

    logger.info('Video with name %s and uuid %s updated.', videoInstance.name, videoInstance.uuid)
  } catch (err) {
    // Force fields we want to update
    // If the transaction is retried, sequelize will think the object has not changed
    // So it will skip the SQL request, even if the last one was ROLLBACKed!
    resetSequelizeInstance(videoInstance, videoFieldsSave)

    throw err
  }
}

function getVideo (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.video

  if (videoInstance.isOwned()) {
    // The increment is done directly in the database, not using the instance value
    // FIXME: make a real view system
    // For example, only add a view when a user watch a video during 30s etc
    videoInstance.increment('views')
      .then(() => {
        const qaduParams = {
          videoId: videoInstance.id,
          type: REQUEST_VIDEO_QADU_TYPES.VIEWS
        }
        return quickAndDirtyUpdateVideoToFriends(qaduParams)
      })
      .catch(err => logger.error('Cannot add view to video %s.', videoInstance.uuid, err))
  } else {
    // Just send the event to our friends
    const eventParams = {
      videoId: videoInstance.id,
      type: REQUEST_VIDEO_EVENT_TYPES.VIEWS
    }
    addEventToRemoteVideo(eventParams)
      .catch(err => logger.error('Cannot add event to remote video %s.', videoInstance.uuid, err))
  }

  // Do not wait the view system
  return res.json(videoInstance.toFormattedDetailsJSON())
}

async function getVideoDescription (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.video
  let description = ''

  if (videoInstance.isOwned()) {
    description = videoInstance.description
  } else {
    description = await fetchRemoteDescription(videoInstance)
  }

  return res.json({ description })
}

async function listVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await db.Video.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function removeVideoRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot remove the video with many retries.'
  }

  await retryTransactionWrapper(removeVideo, options)

  return res.type('json').status(204).end()
}

async function removeVideo (req: express.Request, res: express.Response) {
  const videoInstance: VideoInstance = res.locals.video

  await db.sequelize.transaction(async t => {
    await videoInstance.destroy({ transaction: t })
  })

  logger.info('Video with name %s and uuid %s deleted.', videoInstance.name, videoInstance.uuid)
}

async function searchVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await db.Video.searchAndPopulateAuthorAndPodAndTags(
    req.params.value,
    req.query.field,
    req.query.start,
    req.query.count,
    req.query.sort
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
