import * as express from 'express'
import { body, param, query } from 'express-validator'
import { isVideoRedundancyTarget } from '@server/helpers/custom-validators/video-redundancies'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import {
  exists,
  isBooleanValid,
  isIdOrUUIDValid,
  isIdValid,
  toBooleanOrNull,
  toCompleteUUID,
  toIntOrNull
} from '../../helpers/custom-validators/misc'
import { isHostValid } from '../../helpers/custom-validators/servers'
import { logger } from '../../helpers/logger'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy'
import { ServerModel } from '../../models/server/server'
import { areValidationErrors, doesVideoExist, isValidVideoIdParam } from './shared'

const videoFileRedundancyGetValidator = [
  isValidVideoIdParam('videoId'),

  param('resolution')
    .customSanitizer(toIntOrNull)
    .custom(exists).withMessage('Should have a valid resolution'),
  param('fps')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(exists).withMessage('Should have a valid fps'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoFileRedundancyGetValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    const video = res.locals.videoAll

    const paramResolution = req.params.resolution as unknown as number // We casted to int above
    const paramFPS = req.params.fps as unknown as number // We casted to int above

    const videoFile = video.VideoFiles.find(f => {
      return f.resolution === paramResolution && (!req.params.fps || paramFPS)
    })

    if (!videoFile) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Video file not found.'
      })
    }
    res.locals.videoFile = videoFile

    const videoRedundancy = await VideoRedundancyModel.loadLocalByFileId(videoFile.id)
    if (!videoRedundancy) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Video redundancy not found.'
      })
    }
    res.locals.videoRedundancy = videoRedundancy

    return next()
  }
]

const videoPlaylistRedundancyGetValidator = [
  isValidVideoIdParam('videoId'),

  param('streamingPlaylistType')
    .customSanitizer(toIntOrNull)
    .custom(exists).withMessage('Should have a valid streaming playlist type'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoPlaylistRedundancyGetValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    const video = res.locals.videoAll

    const paramPlaylistType = req.params.streamingPlaylistType as unknown as number // We casted to int above
    const videoStreamingPlaylist = video.VideoStreamingPlaylists.find(p => p.type === paramPlaylistType)

    if (!videoStreamingPlaylist) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Video playlist not found.'
      })
    }
    res.locals.videoStreamingPlaylist = videoStreamingPlaylist

    const videoRedundancy = await VideoRedundancyModel.loadLocalByStreamingPlaylistId(videoStreamingPlaylist.id)
    if (!videoRedundancy) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Video redundancy not found.'
      })
    }
    res.locals.videoRedundancy = videoRedundancy

    return next()
  }
]

const updateServerRedundancyValidator = [
  param('host').custom(isHostValid).withMessage('Should have a valid host'),
  body('redundancyAllowed')
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid redundancyAllowed attribute'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking updateServerRedundancy parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const server = await ServerModel.loadByHost(req.params.host)

    if (!server) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: `Server ${req.params.host} not found.`
      })
    }

    res.locals.server = server
    return next()
  }
]

const listVideoRedundanciesValidator = [
  query('target')
    .custom(isVideoRedundancyTarget).withMessage('Should have a valid video redundancies target'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoRedundanciesValidator parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const addVideoRedundancyValidator = [
  body('videoId')
    .customSanitizer(toCompleteUUID)
    .custom(isIdOrUUIDValid)
    .withMessage('Should have a valid video id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking addVideoRedundancyValidator parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    if (!await doesVideoExist(req.body.videoId, res, 'only-video')) return

    if (res.locals.onlyVideo.remote === false) {
      return res.fail({ message: 'Cannot create a redundancy on a local video' })
    }

    if (res.locals.onlyVideo.isLive) {
      return res.fail({ message: 'Cannot create a redundancy of a live video' })
    }

    const alreadyExists = await VideoRedundancyModel.isLocalByVideoUUIDExists(res.locals.onlyVideo.uuid)
    if (alreadyExists) {
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: 'This video is already duplicated by your instance.'
      })
    }

    return next()
  }
]

const removeVideoRedundancyValidator = [
  param('redundancyId')
    .custom(isIdValid)
    .withMessage('Should have a valid redundancy id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking removeVideoRedundancyValidator parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    const redundancy = await VideoRedundancyModel.loadByIdWithVideo(parseInt(req.params.redundancyId, 10))
    if (!redundancy) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Video redundancy not found'
      })
    }

    res.locals.videoRedundancy = redundancy

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoFileRedundancyGetValidator,
  videoPlaylistRedundancyGetValidator,
  updateServerRedundancyValidator,
  listVideoRedundanciesValidator,
  addVideoRedundancyValidator,
  removeVideoRedundancyValidator
}
