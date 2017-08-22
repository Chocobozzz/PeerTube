import * as express from 'express'

import { database } from '../../initializers'
import { logger, getFormatedObjects } from '../../helpers'
import { RestBlacklistedVideoInstance, ResultList } from '../../../shared'
import { VideoInstance, BlacklistedVideoInstance } from '../../models'

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
    .then(resultList => res.json(formatBlacklistForRest(resultList)))
    .catch(err => next(err))
}

function removeVideoFromBlacklist (req: express.Request, res: express.Response, next: express.NextFunction) {
  database.BlacklistedVideo.loadById(req.params.id)
    .then(entry => entry.destroy())
    .then(() => res.sendStatus(204))
    .catch(err => {
      logger.error('Errors when remove the video from the blacklist', { error: err })
      return next(err)
    })
}

function formatBlacklistForRest (resultList) : ResultList<RestBlacklistedVideoInstance> {
  let formatedList: RestBlacklistedVideoInstance[] = []

  formatedList = resultList.data.map(object => {
    let json = object.toFormattedJSON()
    if (json) {
      return formatBlacklistObject(object, object.Video)
    }
  })

  return {
    total: formatedList.length,
    data: formatedList
  }
}

function formatBlacklistObject (blacklist: BlacklistedVideoInstance, video: VideoInstance) : RestBlacklistedVideoInstance {
  return {
    id: blacklist.id,
    videoId: blacklist.videoId,
    name: video.name,
    uuid: video.uuid,
    description: video.description,
    duration: video.duration,
    views: video.views,
    likes: video.likes,
    dislikes: video.dislikes,
    nsfw: video.nsfw,
    createdAt: blacklist.createdAt,
    updatedAt: blacklist.updatedAt
  }
}
