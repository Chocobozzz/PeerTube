import * as express from 'express'
import * as multer from 'multer'
import { extname, join } from 'path'
import { VideoCreate, VideoPrivacy, VideoUpdate } from '../../../../shared'
import {
  generateRandomString,
  getFormattedObjects,
  getVideoFileHeight,
  logger,
  renamePromise,
  resetSequelizeInstance,
  retryTransactionWrapper
} from '../../../helpers'
import { getServerActor } from '../../../helpers/utils'
import {
  CONFIG,
  sequelizeTypescript,
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_MIMETYPE_EXT,
  VIDEO_PRIVACIES
} from '../../../initializers'
import {
  fetchRemoteVideoDescription,
  getVideoActivityPubUrl,
  shareVideoByServerAndChannel
} from '../../../lib/activitypub'
import { sendCreateVideo, sendCreateViewToOrigin, sendCreateViewToVideoFollowers, sendUpdateVideo } from '../../../lib/activitypub/send'
import { transcodingJobScheduler } from '../../../lib/jobs/transcoding-job-scheduler'
import {
  asyncMiddleware,
  authenticate,
  paginationValidator,
  setPagination,
  setVideosSort,
  videosAddValidator,
  videosGetValidator,
  videosRemoveValidator,
  videosSearchValidator,
  videosSortValidator,
  videosUpdateValidator
} from '../../../middlewares'
import { TagModel } from '../../../models/video/tag'
import { VideoModel } from '../../../models/video/video'
import { VideoFileModel } from '../../../models/video/video-file'
import { abuseVideoRouter } from './abuse'
import { blacklistRouter } from './blacklist'
import { videoChannelRouter } from './channel'
import { rateVideoRouter } from './rate'

const videosRouter = express.Router()

// multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CONFIG.STORAGE.VIDEOS_DIR)
  },

  filename: async (req, file, cb) => {
    const extension = VIDEO_MIMETYPE_EXT[file.mimetype]
    let randomString = ''

    try {
      randomString = await generateRandomString(16)
    } catch (err) {
      logger.error('Cannot generate random string for file name.', err)
      randomString = 'fake-random-string'
    }

    cb(null, randomString + extension)
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
videosRouter.get('/privacies', listVideoPrivacies)

videosRouter.get('/',
  paginationValidator,
  videosSortValidator,
  setVideosSort,
  setPagination,
  asyncMiddleware(listVideos)
)
videosRouter.get('/search',
  videosSearchValidator,
  paginationValidator,
  videosSortValidator,
  setVideosSort,
  setPagination,
  asyncMiddleware(searchVideos)
)
videosRouter.put('/:id',
  authenticate,
  asyncMiddleware(videosUpdateValidator),
  asyncMiddleware(updateVideoRetryWrapper)
)
videosRouter.post('/upload',
  authenticate,
  reqFiles,
  asyncMiddleware(videosAddValidator),
  asyncMiddleware(addVideoRetryWrapper)
)

videosRouter.get('/:id/description',
  asyncMiddleware(videosGetValidator),
  asyncMiddleware(getVideoDescription)
)
videosRouter.get('/:id',
  asyncMiddleware(videosGetValidator),
  getVideo
)
videosRouter.post('/:id/views',
  asyncMiddleware(videosGetValidator),
  asyncMiddleware(viewVideo)
)

videosRouter.delete('/:id',
  authenticate,
  asyncMiddleware(videosRemoveValidator),
  asyncMiddleware(removeVideoRetryWrapper)
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

function listVideoPrivacies (req: express.Request, res: express.Response) {
  res.json(VIDEO_PRIVACIES)
}

// Wrapper to video add that retry the function if there is a database error
// We need this because we run the transaction in SERIALIZABLE isolation that can fail
async function addVideoRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res, req.files['videofile'][0] ],
    errorMessage: 'Cannot insert the video with many retries.'
  }

  const video = await retryTransactionWrapper(addVideo, options)

  res.json({
    video: {
      id: video.id,
      uuid: video.uuid
    }
  }).end()
}

async function addVideo (req: express.Request, res: express.Response, videoPhysicalFile: Express.Multer.File) {
  const videoInfo: VideoCreate = req.body

  // Prepare data so we don't block the transaction
  const videoData = {
    name: videoInfo.name,
    remote: false,
    extname: extname(videoPhysicalFile.filename),
    category: videoInfo.category,
    licence: videoInfo.licence,
    language: videoInfo.language,
    nsfw: videoInfo.nsfw,
    description: videoInfo.description,
    privacy: videoInfo.privacy,
    duration: videoPhysicalFile['duration'], // duration was added by a previous middleware
    channelId: res.locals.videoChannel.id
  }
  const video = new VideoModel(videoData)
  video.url = getVideoActivityPubUrl(video)

  const videoFilePath = join(CONFIG.STORAGE.VIDEOS_DIR, videoPhysicalFile.filename)
  const videoFileHeight = await getVideoFileHeight(videoFilePath)

  const videoFileData = {
    extname: extname(videoPhysicalFile.filename),
    resolution: videoFileHeight,
    size: videoPhysicalFile.size
  }
  const videoFile = new VideoFileModel(videoFileData)
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
  await Promise.all(tasks)

  return sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    if (CONFIG.TRANSCODING.ENABLED === true) {
      // Put uuid because we don't have id auto incremented for now
      const dataInput = {
        videoUUID: video.uuid
      }

      await transcodingJobScheduler.createJob(t, 'videoFileOptimizer', dataInput)
    }

    const videoCreated = await video.save(sequelizeOptions)
    // Do not forget to add video channel information to the created video
    videoCreated.VideoChannel = res.locals.videoChannel

    videoFile.videoId = video.id
    await videoFile.save(sequelizeOptions)

    video.VideoFiles = [ videoFile ]

    if (videoInfo.tags) {
      const tagInstances = await TagModel.findOrCreateTags(videoInfo.tags, t)

      await video.$set('Tags', tagInstances, sequelizeOptions)
      video.Tags = tagInstances
    }

    // Let transcoding job send the video to friends because the video file extension might change
    if (CONFIG.TRANSCODING.ENABLED === true) return videoCreated
    // Don't send video to remote servers, it is private
    if (video.privacy === VideoPrivacy.PRIVATE) return videoCreated

    await sendCreateVideo(video, t)
    // TODO: share by video channel
    await shareVideoByServerAndChannel(video, t)

    logger.info('Video with name %s and uuid %s created.', videoInfo.name, videoCreated.uuid)

    return videoCreated
  })
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
  const videoInstance: VideoModel = res.locals.video
  const videoFieldsSave = videoInstance.toJSON()
  const videoInfoToUpdate: VideoUpdate = req.body
  const wasPrivateVideo = videoInstance.privacy === VideoPrivacy.PRIVATE

  try {
    await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }

      if (videoInfoToUpdate.name !== undefined) videoInstance.set('name', videoInfoToUpdate.name)
      if (videoInfoToUpdate.category !== undefined) videoInstance.set('category', videoInfoToUpdate.category)
      if (videoInfoToUpdate.licence !== undefined) videoInstance.set('licence', videoInfoToUpdate.licence)
      if (videoInfoToUpdate.language !== undefined) videoInstance.set('language', videoInfoToUpdate.language)
      if (videoInfoToUpdate.nsfw !== undefined) videoInstance.set('nsfw', videoInfoToUpdate.nsfw)
      if (videoInfoToUpdate.privacy !== undefined) videoInstance.set('privacy', parseInt(videoInfoToUpdate.privacy.toString(), 10))
      if (videoInfoToUpdate.description !== undefined) videoInstance.set('description', videoInfoToUpdate.description)

      const videoInstanceUpdated = await videoInstance.save(sequelizeOptions)

      if (videoInfoToUpdate.tags) {
        const tagInstances = await TagModel.findOrCreateTags(videoInfoToUpdate.tags, t)

        await videoInstance.$set('Tags', tagInstances, sequelizeOptions)
        videoInstance.Tags = tagInstances
      }

      // Now we'll update the video's meta data to our friends
      if (wasPrivateVideo === false) {
        await sendUpdateVideo(videoInstanceUpdated, t)
      }

      // Video is not private anymore, send a create action to remote servers
      if (wasPrivateVideo === true && videoInstanceUpdated.privacy !== VideoPrivacy.PRIVATE) {
        await sendCreateVideo(videoInstanceUpdated, t)
        // TODO: Send by video channel
        await shareVideoByServerAndChannel(videoInstanceUpdated, t)
      }
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

  return res.json(videoInstance.toFormattedDetailsJSON())
}

async function viewVideo (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.video

  await videoInstance.increment('views')
  const serverAccount = await getServerActor()

  if (videoInstance.isOwned()) {
    await sendCreateViewToVideoFollowers(serverAccount, videoInstance, undefined)
  } else {
    await sendCreateViewToOrigin(serverAccount, videoInstance, undefined)
  }

  return res.status(204).end()
}

async function getVideoDescription (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.video
  let description = ''

  if (videoInstance.isOwned()) {
    description = videoInstance.description
  } else {
    description = await fetchRemoteVideoDescription(videoInstance)
  }

  return res.json({ description })
}

async function listVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await VideoModel.listForApi(req.query.start, req.query.count, req.query.sort)

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
  const videoInstance: VideoModel = res.locals.video

  await sequelizeTypescript.transaction(async t => {
    await videoInstance.destroy({ transaction: t })
  })

  logger.info('Video with name %s and uuid %s deleted.', videoInstance.name, videoInstance.uuid)
}

async function searchVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await VideoModel.searchAndPopulateAccountAndServerAndTags(
    req.query.search,
    req.query.start,
    req.query.count,
    req.query.sort
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
