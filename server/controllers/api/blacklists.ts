import * as express from 'express'

import { database } from '../../initializers'
import { logger, getFormatedObjects } from '../../helpers'

import {
  authenticate,
  ensureIsAdmin,
  paginationValidator,
  blacklistsSortValidator,
  setBlacklistsSort,
  setPagination,
  blacklistsRemoveValidator
} from '../../middlewares'

const blacklistsRouter = express.Router()

blacklistsRouter.get('/',
  authenticate,
  ensureIsAdmin,
  paginationValidator,
  blacklistsSortValidator,
  setBlacklistsSort,
  setPagination,
  listBlacklist
)

blacklistsRouter.delete('/:id',
  authenticate,
  ensureIsAdmin,
  blacklistsRemoveValidator,
  removeVideoFromBlacklist
)

// ---------------------------------------------------------------------------

export {
  blacklistsRouter
}

// ---------------------------------------------------------------------------

function listBlacklist (req: express.Request, res: express.Response, next: express.NextFunction) {
  database.BlacklistedVideo.listForApi(req.query.start, req.query.count, req.query.sort)
    .then(resultList => {
      res.json(formatBlacklist(resultList.data, resultList.total))
    })
    .catch(err => next(err))
}

function removeVideoFromBlacklist (req: express.Request, res: express.Response, next: express.NextFunction) {
  database.BlacklistedVideo.loadByVideoId(req.params.id)
    .then(entry => entry.destroy())
    .then(() => res.sendStatus(204))
    .catch(err => {
      logger.error('Errors when remove the video from the blacklist', { error: err })
      return next(err)
    })
}

function formatBlacklist (objects, objectsTotal) {
  const formatedObjects = []
  var json = ''

  objects.forEach((object) => {
    json = object.toFormatedJSON()
    if (json) {
      formatedObjects.push(blacklistObjectToJSON(object, object.Video))
    }
  })

  return {
    total: objectsTotal,
    data: formatedObjects
  }
}

function blacklistObjectToJSON (blacklist, video) {
  return {
    id: blacklist.id,
    videoId: blacklist.videoId,
    remoteId: video.remoteId,
    name: video.name,
    nsfw: video.nsfw,
    description: video.description,
    duration: video.duration,
    views: video.views,
    likes: video.likes,
    dislikes: video.dislikes,
    createdAt: blacklist.createdAt,
    updatedAt: blacklist.updatedAt
  }
}
