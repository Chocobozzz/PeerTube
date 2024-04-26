import { HttpStatusCode } from '@peertube/peertube-models'
import { exists, isSafePeerTubeFilenameWithoutExtension, isUUIDValid, toBooleanOrNull } from '@server/helpers/custom-validators/misc.js'
import { logger } from '@server/helpers/logger.js'
import { LRU_CACHE } from '@server/initializers/constants.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoModel } from '@server/models/video/video.js'
import { MStreamingPlaylist, MVideoFile, MVideoThumbnailBlacklist } from '@server/types/models/index.js'
import express from 'express'
import { query } from 'express-validator'
import { LRUCache } from 'lru-cache'
import { basename, dirname } from 'path'
import { areValidationErrors, checkCanAccessVideoStaticFiles, isValidVideoPasswordHeader } from './shared/index.js'

type LRUValue = {
  allowed: boolean
  video?: MVideoThumbnailBlacklist
  file?: MVideoFile
  playlist?: MStreamingPlaylist }

const staticFileTokenBypass = new LRUCache<string, LRUValue>({
  max: LRU_CACHE.STATIC_VIDEO_FILES_RIGHTS_CHECK.MAX_SIZE,
  ttl: LRU_CACHE.STATIC_VIDEO_FILES_RIGHTS_CHECK.TTL
})

const ensureCanAccessVideoPrivateWebVideoFiles = [
  query('videoFileToken').optional().custom(exists),

  isValidVideoPasswordHeader(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const token = extractTokenOrDie(req, res)
    if (!token) return

    const cacheKey = token + '-' + req.originalUrl

    if (staticFileTokenBypass.has(cacheKey)) {
      const { allowed, file, video } = staticFileTokenBypass.get(cacheKey)

      if (allowed === true) {
        res.locals.onlyVideo = video
        res.locals.videoFile = file

        return next()
      }

      return res.sendStatus(HttpStatusCode.FORBIDDEN_403)
    }

    const result = await isWebVideoAllowed(req, res)

    staticFileTokenBypass.set(cacheKey, result)

    if (result.allowed !== true) return

    res.locals.onlyVideo = result.video
    res.locals.videoFile = result.file

    return next()
  }
]

const ensureCanAccessPrivateVideoHLSFiles = [
  query('videoFileToken')
    .optional()
    .custom(exists),

  query('reinjectVideoFileToken')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .isBoolean().withMessage('Should be a valid reinjectVideoFileToken boolean'),

  query('playlistName')
    .optional()
    .customSanitizer(isSafePeerTubeFilenameWithoutExtension),

  isValidVideoPasswordHeader(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const videoUUID = basename(dirname(req.originalUrl))

    if (!isUUIDValid(videoUUID)) {
      logger.debug('Path does not contain valid video UUID to serve static file %s', req.originalUrl)

      return res.sendStatus(HttpStatusCode.FORBIDDEN_403)
    }

    const token = extractTokenOrDie(req, res)
    if (!token) return

    const cacheKey = token + '-' + videoUUID

    if (staticFileTokenBypass.has(cacheKey)) {
      const { allowed, file, playlist, video } = staticFileTokenBypass.get(cacheKey)

      if (allowed === true) {
        res.locals.onlyVideo = video
        res.locals.videoFile = file
        res.locals.videoStreamingPlaylist = playlist

        return next()
      }

      return res.sendStatus(HttpStatusCode.FORBIDDEN_403)
    }

    const result = await isHLSAllowed(req, res, videoUUID)

    staticFileTokenBypass.set(cacheKey, result)

    if (result.allowed !== true) return

    res.locals.onlyVideo = result.video
    res.locals.videoFile = result.file
    res.locals.videoStreamingPlaylist = result.playlist

    return next()
  }
]

export {
  ensureCanAccessPrivateVideoHLSFiles, ensureCanAccessVideoPrivateWebVideoFiles
}

// ---------------------------------------------------------------------------

async function isWebVideoAllowed (req: express.Request, res: express.Response) {
  const filename = basename(req.path)

  const file = await VideoFileModel.loadWithVideoByFilename(filename)
  if (!file) {
    logger.debug('Unknown static file %s to serve', req.originalUrl, { filename })

    res.sendStatus(HttpStatusCode.FORBIDDEN_403)
    return { allowed: false }
  }

  const video = await VideoModel.loadWithBlacklist(file.getVideo().id)

  return {
    file,
    video,
    allowed: await checkCanAccessVideoStaticFiles({ req, res, video, paramId: video.uuid })
  }
}

async function isHLSAllowed (req: express.Request, res: express.Response, videoUUID: string) {
  const filename = basename(req.path)

  const video = await VideoModel.loadAndPopulateAccountAndFiles(videoUUID)

  if (!video) {
    logger.debug('Unknown static file %s to serve', req.originalUrl, { videoUUID })

    res.sendStatus(HttpStatusCode.FORBIDDEN_403)
    return { allowed: false }
  }

  const file = await VideoFileModel.loadByFilename(filename)

  return {
    file,
    video,
    playlist: video.getHLSPlaylist(),
    allowed: await checkCanAccessVideoStaticFiles({ req, res, video, paramId: video.uuid })
  }
}

function extractTokenOrDie (req: express.Request, res: express.Response) {
  const token = req.header('x-peertube-video-password') || req.query.videoFileToken || res.locals.oauth?.token.accessToken

  if (!token) {
    return res.fail({
      message: 'Video password header, video file token query parameter and bearer token are all missing', //
      status: HttpStatusCode.FORBIDDEN_403
    })
  }

  return token
}
