import express from 'express'
import { query } from 'express-validator'
import LRUCache from 'lru-cache'
import { basename, dirname } from 'path'
import { exists, isUUIDValid } from '@server/helpers/custom-validators/misc'
import { logger } from '@server/helpers/logger'
import { LRU_CACHE } from '@server/initializers/constants'
import { VideoModel } from '@server/models/video/video'
import { VideoFileModel } from '@server/models/video/video-file'
import { HttpStatusCode } from '@shared/models'
import { areValidationErrors, checkCanAccessVideoStaticFiles } from './shared'

const staticFileTokenBypass = new LRUCache<string, boolean>({
  max: LRU_CACHE.STATIC_VIDEO_FILES_RIGHTS_CHECK.MAX_SIZE,
  ttl: LRU_CACHE.STATIC_VIDEO_FILES_RIGHTS_CHECK.TTL
})

const ensureCanAccessVideoPrivateWebTorrentFiles = [
  query('videoFileToken').optional().custom(exists),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const token = extractTokenOrDie(req, res)
    if (!token) return

    const cacheKey = token + '-' + req.originalUrl

    if (staticFileTokenBypass.has(cacheKey)) {
      const allowedFromCache = staticFileTokenBypass.get(cacheKey)

      if (allowedFromCache === true) return next()

      return res.sendStatus(HttpStatusCode.FORBIDDEN_403)
    }

    const allowed = await isWebTorrentAllowed(req, res)

    staticFileTokenBypass.set(cacheKey, allowed)

    if (allowed !== true) return

    return next()
  }
]

const ensureCanAccessPrivateVideoHLSFiles = [
  query('videoFileToken').optional().custom(exists),

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
      const allowedFromCache = staticFileTokenBypass.get(cacheKey)

      if (allowedFromCache === true) return next()

      return res.sendStatus(HttpStatusCode.FORBIDDEN_403)
    }

    const allowed = await isHLSAllowed(req, res, videoUUID)

    staticFileTokenBypass.set(cacheKey, allowed)

    if (allowed !== true) return

    return next()
  }
]

export {
  ensureCanAccessVideoPrivateWebTorrentFiles,
  ensureCanAccessPrivateVideoHLSFiles
}

// ---------------------------------------------------------------------------

async function isWebTorrentAllowed (req: express.Request, res: express.Response) {
  const filename = basename(req.path)

  const file = await VideoFileModel.loadWithVideoByFilename(filename)
  if (!file) {
    logger.debug('Unknown static file %s to serve', req.originalUrl, { filename })

    res.sendStatus(HttpStatusCode.FORBIDDEN_403)
    return false
  }

  const video = file.getVideo()

  return checkCanAccessVideoStaticFiles({ req, res, video, paramId: video.uuid })
}

async function isHLSAllowed (req: express.Request, res: express.Response, videoUUID: string) {
  const video = await VideoModel.load(videoUUID)

  if (!video) {
    logger.debug('Unknown static file %s to serve', req.originalUrl, { videoUUID })

    res.sendStatus(HttpStatusCode.FORBIDDEN_403)
    return false
  }

  return checkCanAccessVideoStaticFiles({ req, res, video, paramId: video.uuid })
}

function extractTokenOrDie (req: express.Request, res: express.Response) {
  const token = res.locals.oauth?.token.accessToken || req.query.videoFileToken

  if (!token) {
    return res.fail({
      message: 'Bearer token is missing in headers or video file token is missing in URL query parameters',
      status: HttpStatusCode.FORBIDDEN_403
    })
  }

  return token
}
