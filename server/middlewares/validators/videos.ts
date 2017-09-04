import 'express-validator'
import * as express from 'express'
import * as Promise from 'bluebird'
import * as validator from 'validator'

import { database as db } from '../../initializers/database'
import { checkErrors } from './utils'
import { CONSTRAINTS_FIELDS, SEARCHABLE_COLUMNS } from '../../initializers'
import { logger, isVideoDurationValid } from '../../helpers'
import { VideoInstance } from '../../models'

function videosAddValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  // FIXME: Don't write an error message, it seems there is a bug with express-validator
  // 'Should have a valid file'
  req.checkBody('videofile').isVideoFile(req.files)
  req.checkBody('name', 'Should have a valid name').isVideoNameValid()
  req.checkBody('category', 'Should have a valid category').isVideoCategoryValid()
  req.checkBody('licence', 'Should have a valid licence').isVideoLicenceValid()
  req.checkBody('language', 'Should have a valid language').optional().isVideoLanguageValid()
  req.checkBody('nsfw', 'Should have a valid NSFW attribute').isVideoNSFWValid()
  req.checkBody('description', 'Should have a valid description').isVideoDescriptionValid()
  req.checkBody('tags', 'Should have correct tags').optional().isVideoTagsValid()

  logger.debug('Checking videosAdd parameters', { parameters: req.body, files: req.files })

  checkErrors(req, res, () => {
    const videoFile: Express.Multer.File = req.files['videofile'][0]
    const user = res.locals.oauth.token.User

    user.isAbleToUploadVideo(videoFile)
      .then(isAble => {
        if (isAble === false) {
          res.status(403).send('The user video quota is exceeded with this video.')

          return undefined
        }

        return db.Video.getDurationFromFile(videoFile.path)
      })
      .then(duration => {
        // Previous test failed, abort
        if (duration === undefined) return

        if (!isVideoDurationValid('' + duration)) {
          return res.status(400).send('Duration of the video file is too big (max: ' + CONSTRAINTS_FIELDS.VIDEOS.DURATION.max + 's).')
        }

        videoFile['duration'] = duration
        next()
      })
      .catch(err => {
        logger.error('Error in getting duration from file.', err)
        res.status(400).send('Cannot retrieve metadata of the file.')
      })
  })
}

function videosUpdateValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isVideoIdOrUUIDValid()
  req.checkBody('name', 'Should have a valid name').optional().isVideoNameValid()
  req.checkBody('category', 'Should have a valid category').optional().isVideoCategoryValid()
  req.checkBody('licence', 'Should have a valid licence').optional().isVideoLicenceValid()
  req.checkBody('language', 'Should have a valid language').optional().isVideoLanguageValid()
  req.checkBody('nsfw', 'Should have a valid NSFW attribute').optional().isVideoNSFWValid()
  req.checkBody('description', 'Should have a valid description').optional().isVideoDescriptionValid()
  req.checkBody('tags', 'Should have correct tags').optional().isVideoTagsValid()

  logger.debug('Checking videosUpdate parameters', { parameters: req.body })

  checkErrors(req, res, () => {
    checkVideoExists(req.params.id, res, () => {
      // We need to make additional checks
      if (res.locals.video.isOwned() === false) {
        return res.status(403).send('Cannot update video of another pod')
      }

      if (res.locals.video.Author.userId !== res.locals.oauth.token.User.id) {
        return res.status(403).send('Cannot update video of another user')
      }

      next()
    })
  })
}

function videosGetValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isVideoIdOrUUIDValid()

  logger.debug('Checking videosGet parameters', { parameters: req.params })

  checkErrors(req, res, () => {
    checkVideoExists(req.params.id, res, next)
  })
}

function videosRemoveValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isVideoIdOrUUIDValid()

  logger.debug('Checking videosRemove parameters', { parameters: req.params })

  checkErrors(req, res, () => {
    checkVideoExists(req.params.id, res, () => {
      // We need to make additional checks

      // Check if the user who did the request is able to delete the video
      checkUserCanDeleteVideo(res.locals.oauth.token.User.id, res, () => {
        next()
      })
    })
  })
}

function videosSearchValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  const searchableColumns = SEARCHABLE_COLUMNS.VIDEOS
  req.checkParams('value', 'Should have a valid search').notEmpty()
  req.checkQuery('field', 'Should have correct searchable column').optional().isIn(searchableColumns)

  logger.debug('Checking videosSearch parameters', { parameters: req.params })

  checkErrors(req, res, next)
}

function videoAbuseReportValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isVideoIdOrUUIDValid()
  req.checkBody('reason', 'Should have a valid reason').isVideoAbuseReasonValid()

  logger.debug('Checking videoAbuseReport parameters', { parameters: req.body })

  checkErrors(req, res, () => {
    checkVideoExists(req.params.id, res, next)
  })
}

function videoRateValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isVideoIdOrUUIDValid()
  req.checkBody('rating', 'Should have a valid rate type').isVideoRatingTypeValid()

  logger.debug('Checking videoRate parameters', { parameters: req.body })

  checkErrors(req, res, () => {
    checkVideoExists(req.params.id, res, next)
  })
}

function videosBlacklistValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isVideoIdOrUUIDValid()

  logger.debug('Checking videosBlacklist parameters', { parameters: req.params })

  checkErrors(req, res, () => {
    checkVideoExists(req.params.id, res, () => {
      checkVideoIsBlacklistable(req, res, next)
    })
  })
}

// ---------------------------------------------------------------------------

export {
  videosAddValidator,
  videosUpdateValidator,
  videosGetValidator,
  videosRemoveValidator,
  videosSearchValidator,

  videoAbuseReportValidator,

  videoRateValidator,

  videosBlacklistValidator
}

// ---------------------------------------------------------------------------

function checkVideoExists (id: string, res: express.Response, callback: () => void) {
  let promise: Promise<VideoInstance>
  if (validator.isInt(id)) {
    promise = db.Video.loadAndPopulateAuthorAndPodAndTags(+id)
  } else { // UUID
    promise = db.Video.loadByUUIDAndPopulateAuthorAndPodAndTags(id)
  }

  promise.then(video => {
    if (!video) return res.status(404).send('Video not found')

    res.locals.video = video
    callback()
  })
  .catch(err => {
    logger.error('Error in video request validator.', err)
    return res.sendStatus(500)
  })
}

function checkUserCanDeleteVideo (userId: number, res: express.Response, callback: () => void) {
  // Retrieve the user who did the request
  db.User.loadById(userId)
    .then(user => {
      // Check if the user can delete the video
      // The user can delete it if s/he is an admin
      // Or if s/he is the video's author
      if (user.isAdmin() === false) {
        if (res.locals.video.isOwned() === false) {
          return res.status(403).send('Cannot remove video of another pod')
        }

        if (res.locals.video.Author.userId !== res.locals.oauth.token.User.id) {
          return res.status(403).send('Cannot remove video of another user')
        }
      }

      // If we reach this comment, we can delete the video
      callback()
    })
    .catch(err => {
      logger.error('Error in video request validator.', err)
      return res.sendStatus(500)
    })
}

function checkVideoIsBlacklistable (req: express.Request, res: express.Response, callback: () => void) {
  if (res.locals.video.isOwned() === true) {
    return res.status(403).send('Cannot blacklist a local video')
  }

  callback()
}
