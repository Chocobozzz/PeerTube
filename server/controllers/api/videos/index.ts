import * as express from 'express'
import * as Sequelize from 'sequelize'
import * as fs from 'fs'
import * as multer from 'multer'
import * as path from 'path'
import { waterfall } from 'async'

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
  updateVideoToFriends
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
  commitTransaction,
  retryTransactionWrapper,
  rollbackTransaction,
  startSerializableTransaction,
  generateRandomString,
  getFormatedObjects
} from '../../../helpers'

import { abuseVideoRouter } from './abuse'
import { blacklistRouter } from './blacklist'
import { rateVideoRouter } from './rate'

const videosRouter = express.Router()

// multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, CONFIG.STORAGE.VIDEOS_DIR)
  },

  filename: function (req, file, cb) {
    let extension = ''
    if (file.mimetype === 'video/webm') extension = 'webm'
    else if (file.mimetype === 'video/mp4') extension = 'mp4'
    else if (file.mimetype === 'video/ogg') extension = 'ogv'
    generateRandomString(16, function (err, randomString) {
      const fieldname = err ? undefined : randomString
      cb(null, fieldname + '.' + extension)
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
videosRouter.post('/',
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
  removeVideo
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

function listVideoCategories (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.json(VIDEO_CATEGORIES)
}

function listVideoLicences (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.json(VIDEO_LICENCES)
}

function listVideoLanguages (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.json(VIDEO_LANGUAGES)
}

// Wrapper to video add that retry the function if there is a database error
// We need this because we run the transaction in SERIALIZABLE isolation that can fail
function addVideoRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res, req.files.videofile[0] ],
    errorMessage: 'Cannot insert the video with many retries.'
  }

  retryTransactionWrapper(addVideo, options, function (err) {
    if (err) return next(err)

    // TODO : include Location of the new video -> 201
    return res.type('json').status(204).end()
  })
}

function addVideo (req: express.Request, res: express.Response, videoFile: Express.Multer.File, finalCallback: (err: Error) => void) {
  const videoInfos = req.body

  waterfall([

    startSerializableTransaction,

    function findOrCreateAuthor (t, callback) {
      const user = res.locals.oauth.token.User

      const name = user.username
      // null because it is OUR pod
      const podId = null
      const userId = user.id

      db.Author.findOrCreateAuthor(name, podId, userId, t, function (err, authorInstance) {
        return callback(err, t, authorInstance)
      })
    },

    function findOrCreateTags (t, author, callback) {
      const tags = videoInfos.tags

      db.Tag.findOrCreateTags(tags, t, function (err, tagInstances) {
        return callback(err, t, author, tagInstances)
      })
    },

    function createVideoObject (t, author, tagInstances, callback) {
      const videoData = {
        name: videoInfos.name,
        remoteId: null,
        extname: path.extname(videoFile.filename),
        category: videoInfos.category,
        licence: videoInfos.licence,
        language: videoInfos.language,
        nsfw: videoInfos.nsfw,
        description: videoInfos.description,
        duration: videoFile['duration'], // duration was added by a previous middleware
        authorId: author.id
      }

      const video = db.Video.build(videoData)

      return callback(null, t, author, tagInstances, video)
    },

     // Set the videoname the same as the id
    function renameVideoFile (t, author, tagInstances, video, callback) {
      const videoDir = CONFIG.STORAGE.VIDEOS_DIR
      const source = path.join(videoDir, videoFile.filename)
      const destination = path.join(videoDir, video.getVideoFilename())

      fs.rename(source, destination, function (err) {
        if (err) return callback(err)

        // This is important in case if there is another attempt
        videoFile.filename = video.getVideoFilename()
        return callback(null, t, author, tagInstances, video)
      })
    },

    function insertVideoIntoDB (t, author, tagInstances, video, callback) {
      const options = { transaction: t }

      // Add tags association
      video.save(options).asCallback(function (err, videoCreated) {
        if (err) return callback(err)

        // Do not forget to add Author informations to the created video
        videoCreated.Author = author

        return callback(err, t, tagInstances, videoCreated)
      })
    },

    function associateTagsToVideo (t, tagInstances, video, callback) {
      const options = { transaction: t }

      video.setTags(tagInstances, options).asCallback(function (err) {
        video.Tags = tagInstances

        return callback(err, t, video)
      })
    },

    function sendToFriends (t, video, callback) {
      // Let transcoding job send the video to friends because the videofile extension might change
      if (CONFIG.TRANSCODING.ENABLED === true) return callback(null, t)

      video.toAddRemoteJSON(function (err, remoteVideo) {
        if (err) return callback(err)

        // Now we'll add the video's meta data to our friends
        addVideoToFriends(remoteVideo, t, function (err) {
          return callback(err, t)
        })
      })
    },

    commitTransaction

  ], function andFinally (err: Error, t: Sequelize.Transaction) {
    if (err) {
      // This is just a debug because we will retry the insert
      logger.debug('Cannot insert the video.', { error: err })
      return rollbackTransaction(err, t, finalCallback)
    }

    logger.info('Video with name %s created.', videoInfos.name)
    return finalCallback(null)
  })
}

function updateVideoRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot update the video with many retries.'
  }

  retryTransactionWrapper(updateVideo, options, function (err) {
    if (err) return next(err)

    // TODO : include Location of the new video -> 201
    return res.type('json').status(204).end()
  })
}

function updateVideo (req: express.Request, res: express.Response, finalCallback: (err: Error) => void) {
  const videoInstance = res.locals.video
  const videoFieldsSave = videoInstance.toJSON()
  const videoInfosToUpdate = req.body

  waterfall([

    startSerializableTransaction,

    function findOrCreateTags (t, callback) {
      if (videoInfosToUpdate.tags) {
        db.Tag.findOrCreateTags(videoInfosToUpdate.tags, t, function (err, tagInstances) {
          return callback(err, t, tagInstances)
        })
      } else {
        return callback(null, t, null)
      }
    },

    function updateVideoIntoDB (t, tagInstances, callback) {
      const options = {
        transaction: t
      }

      if (videoInfosToUpdate.name !== undefined) videoInstance.set('name', videoInfosToUpdate.name)
      if (videoInfosToUpdate.category !== undefined) videoInstance.set('category', videoInfosToUpdate.category)
      if (videoInfosToUpdate.licence !== undefined) videoInstance.set('licence', videoInfosToUpdate.licence)
      if (videoInfosToUpdate.language !== undefined) videoInstance.set('language', videoInfosToUpdate.language)
      if (videoInfosToUpdate.nsfw !== undefined) videoInstance.set('nsfw', videoInfosToUpdate.nsfw)
      if (videoInfosToUpdate.description !== undefined) videoInstance.set('description', videoInfosToUpdate.description)

      videoInstance.save(options).asCallback(function (err) {
        return callback(err, t, tagInstances)
      })
    },

    function associateTagsToVideo (t, tagInstances, callback) {
      if (tagInstances) {
        const options = { transaction: t }

        videoInstance.setTags(tagInstances, options).asCallback(function (err) {
          videoInstance.Tags = tagInstances

          return callback(err, t)
        })
      } else {
        return callback(null, t)
      }
    },

    function sendToFriends (t, callback) {
      const json = videoInstance.toUpdateRemoteJSON()

      // Now we'll update the video's meta data to our friends
      updateVideoToFriends(json, t, function (err) {
        return callback(err, t)
      })
    },

    commitTransaction

  ], function andFinally (err: Error, t: Sequelize.Transaction) {
    if (err) {
      logger.debug('Cannot update the video.', { error: err })

      // Force fields we want to update
      // If the transaction is retried, sequelize will think the object has not changed
      // So it will skip the SQL request, even if the last one was ROLLBACKed!
      Object.keys(videoFieldsSave).forEach(function (key) {
        const value = videoFieldsSave[key]
        videoInstance.set(key, value)
      })

      return rollbackTransaction(err, t, finalCallback)
    }

    logger.info('Video with name %s updated.', videoInstance.name)
    return finalCallback(null)
  })
}

function getVideo (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoInstance = res.locals.video

  if (videoInstance.isOwned()) {
    // The increment is done directly in the database, not using the instance value
    videoInstance.increment('views').asCallback(function (err) {
      if (err) {
        logger.error('Cannot add view to video %d.', videoInstance.id)
        return
      }

      // FIXME: make a real view system
      // For example, only add a view when a user watch a video during 30s etc
      const qaduParams = {
        videoId: videoInstance.id,
        type: REQUEST_VIDEO_QADU_TYPES.VIEWS
      }
      quickAndDirtyUpdateVideoToFriends(qaduParams)
    })
  } else {
    // Just send the event to our friends
    const eventParams = {
      videoId: videoInstance.id,
      type: REQUEST_VIDEO_EVENT_TYPES.VIEWS
    }
    addEventToRemoteVideo(eventParams)
  }

  // Do not wait the view system
  res.json(videoInstance.toFormatedJSON())
}

function listVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.Video.listForApi(req.query.start, req.query.count, req.query.sort, function (err, videosList, videosTotal) {
    if (err) return next(err)

    res.json(getFormatedObjects(videosList, videosTotal))
  })
}

function removeVideo (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoInstance = res.locals.video

  videoInstance.destroy().asCallback(function (err) {
    if (err) {
      logger.error('Errors when removed the video.', { error: err })
      return next(err)
    }

    return res.type('json').status(204).end()
  })
}

function searchVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.Video.searchAndPopulateAuthorAndPodAndTags(
    req.params.value, req.query.field, req.query.start, req.query.count, req.query.sort,
    function (err, videosList, videosTotal) {
      if (err) return next(err)

      res.json(getFormatedObjects(videosList, videosTotal))
    }
  )
}
