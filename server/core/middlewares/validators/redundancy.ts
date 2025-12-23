import express from 'express'
import { body, param, query } from 'express-validator'
import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { isVideoRedundancyTarget } from '@server/helpers/custom-validators/video-redundancies.js'
import {
  exists,
  isBooleanValid,
  isIdOrUUIDValid,
  isIdValid,
  toBooleanOrNull,
  toCompleteUUID,
  toIntOrNull
} from '../../helpers/custom-validators/misc.js'
import { isHostValid } from '../../helpers/custom-validators/servers.js'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy.js'
import { ServerModel } from '../../models/server/server.js'
import { areValidationErrors, doesVideoExist, isValidVideoIdParam } from './shared/index.js'
import { canVideoBeFederated } from '@server/lib/activitypub/videos/federate.js'

const videoPlaylistRedundancyGetValidator = [
  isValidVideoIdParam('videoId'),

  param('streamingPlaylistType')
    .customSanitizer(toIntOrNull)
    .custom(exists),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    const video = res.locals.videoAll
    if (!canVideoBeFederated(video)) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

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
  param('host')
    .custom(isHostValid),

  body('redundancyAllowed')
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid redundancyAllowed boolean'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    .custom(isVideoRedundancyTarget),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const addVideoRedundancyValidator = [
  body('videoId')
    .customSanitizer(toCompleteUUID)
    .custom(isIdOrUUIDValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoExist(req.body.videoId, res, 'only-video-and-blacklist')) return

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
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const redundancy = await VideoRedundancyModel.loadByIdWithVideo(forceNumber(req.params.redundancyId))
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
  videoPlaylistRedundancyGetValidator,
  updateServerRedundancyValidator,
  listVideoRedundanciesValidator,
  addVideoRedundancyValidator,
  removeVideoRedundancyValidator
}
