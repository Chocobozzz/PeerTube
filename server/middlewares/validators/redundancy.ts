import * as express from 'express'
import { body, param } from 'express-validator'
import { exists, isBooleanValid, isIdOrUUIDValid, toBooleanOrNull, toIntOrNull } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy'
import { isHostValid } from '../../helpers/custom-validators/servers'
import { ServerModel } from '../../models/server/server'
import { doesVideoExist } from '../../helpers/middlewares'

const videoFileRedundancyGetValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid video id'),
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

    const video = res.locals.video
    const videoFile = video.VideoFiles.find(f => {
      return f.resolution === req.params.resolution && (!req.params.fps || f.fps === req.params.fps)
    })

    if (!videoFile) return res.status(404).json({ error: 'Video file not found.' })
    res.locals.videoFile = videoFile

    const videoRedundancy = await VideoRedundancyModel.loadLocalByFileId(videoFile.id)
    if (!videoRedundancy) return res.status(404).json({ error: 'Video redundancy not found.' })
    res.locals.videoRedundancy = videoRedundancy

    return next()
  }
]

const videoPlaylistRedundancyGetValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid video id'),
  param('streamingPlaylistType').custom(exists).withMessage('Should have a valid streaming playlist type'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoPlaylistRedundancyGetValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    const video = res.locals.video
    const videoStreamingPlaylist = video.VideoStreamingPlaylists.find(p => p === req.params.streamingPlaylistType)

    if (!videoStreamingPlaylist) return res.status(404).json({ error: 'Video playlist not found.' })
    res.locals.videoStreamingPlaylist = videoStreamingPlaylist

    const videoRedundancy = await VideoRedundancyModel.loadLocalByStreamingPlaylistId(videoStreamingPlaylist.id)
    if (!videoRedundancy) return res.status(404).json({ error: 'Video redundancy not found.' })
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
      return res
        .status(404)
        .json({
          error: `Server ${req.params.host} not found.`
        })
        .end()
    }

    res.locals.server = server
    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoFileRedundancyGetValidator,
  videoPlaylistRedundancyGetValidator,
  updateServerRedundancyValidator
}
