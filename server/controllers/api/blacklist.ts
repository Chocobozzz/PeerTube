import * as express from 'express'

import { database } from '../../initializers'
import { BlacklistedVideo, ResultList } from '../../../shared'
import { VideoInstance, BlacklistedVideoInstance } from '../../models'

import {
  removeVideoFromBlacklist
} from '../../lib'
import {
  authenticate,
  ensureIsAdmin,
  paginationValidator,
  blacklistSortValidator,
  setBlacklistSort,
  setPagination,
  blacklistRemoveValidator
} from '../../middlewares'

const blacklistRouter = express.Router()

blacklistRouter.get('/',
  authenticate,
  ensureIsAdmin,
  paginationValidator,
  blacklistSortValidator,
  setBlacklistSort,
  setPagination,
  listBlacklist
)

blacklistRouter.delete('/:id',
  authenticate,
  ensureIsAdmin,
  blacklistRemoveValidator,
  removeVideoFromBlacklistController
)

// ---------------------------------------------------------------------------

export {
  blacklistRouter
}

// ---------------------------------------------------------------------------

function listBlacklist (req: express.Request, res: express.Response, next: express.NextFunction) {
  database.BlacklistedVideo.listForApi(req.query.start, req.query.count, req.query.sort)
    .then(resultList => res.json(formatBlacklistForRest(resultList)))
    .catch(err => next(err))
}

function removeVideoFromBlacklistController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const entry = res.locals.blacklistEntryToRemove as BlacklistedVideoInstance

  removeVideoFromBlacklist(entry)
    .then(() => res.sendStatus(204))
    .catch(err => next(err))
}

function formatBlacklistForRest (resultList): ResultList<BlacklistedVideo> {
  let formatedList: BlacklistedVideo[] = []

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

function formatBlacklistObject (blacklist: BlacklistedVideoInstance, video: VideoInstance): BlacklistedVideo {
  return {
    id: blacklist.id,
    videoId: blacklist.videoId,
    createdAt: blacklist.createdAt,
    updatedAt: blacklist.updatedAt,
    name: video.name,
    uuid: video.uuid,
    description: video.description,
    duration: video.duration,
    views: video.views,
    likes: video.likes,
    dislikes: video.dislikes,
    nsfw: video.nsfw
  }
}
