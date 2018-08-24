import * as express from 'express'
import { buildNSFWFilter, isUserAbleToSearchRemoteURI } from '../../helpers/express-utils'
import { getFormattedObjects, getServerActor } from '../../helpers/utils'
import { VideoModel } from '../../models/video/video'
import {
  asyncMiddleware,
  commonVideosFiltersValidator,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSearchSort,
  videoChannelsSearchSortValidator,
  videoChannelsSearchValidator,
  videosSearchSortValidator,
  videosSearchValidator
} from '../../middlewares'
import { VideoChannelsSearchQuery, VideosSearchQuery } from '../../../shared/models/search'
import { getOrCreateActorAndServerAndModel, getOrCreateVideoAndAccountAndChannel } from '../../lib/activitypub'
import { logger } from '../../helpers/logger'
import { User } from '../../../shared/models/users'
import { CONFIG } from '../../initializers/constants'
import { VideoChannelModel } from '../../models/video/video-channel'
import { loadActorUrlOrGetFromWebfinger } from '../../helpers/webfinger'

const searchRouter = express.Router()

searchRouter.get('/videos',
  paginationValidator,
  setDefaultPagination,
  videosSearchSortValidator,
  setDefaultSearchSort,
  optionalAuthenticate,
  commonVideosFiltersValidator,
  videosSearchValidator,
  asyncMiddleware(searchVideos)
)

searchRouter.get('/video-channels',
  paginationValidator,
  setDefaultPagination,
  videoChannelsSearchSortValidator,
  setDefaultSearchSort,
  optionalAuthenticate,
  videoChannelsSearchValidator,
  asyncMiddleware(searchVideoChannels)
)

// ---------------------------------------------------------------------------

export { searchRouter }

// ---------------------------------------------------------------------------

function searchVideoChannels (req: express.Request, res: express.Response) {
  const query: VideoChannelsSearchQuery = req.query
  const search = query.search

  const isURISearch = search.startsWith('http://') || search.startsWith('https://')

  const parts = search.split('@')
  const isWebfingerSearch = parts.length === 2 && parts.every(p => p.indexOf(' ') === -1)

  if (isURISearch || isWebfingerSearch) return searchVideoChannelURI(search, isWebfingerSearch, res)

  return searchVideoChannelsDB(query, res)
}

async function searchVideoChannelsDB (query: VideoChannelsSearchQuery, res: express.Response) {
  const serverActor = await getServerActor()

  const options = {
    actorId: serverActor.id,
    search: query.search,
    start: query.start,
    count: query.count,
    sort: query.sort
  }
  const resultList = await VideoChannelModel.searchForApi(options)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function searchVideoChannelURI (search: string, isWebfingerSearch: boolean, res: express.Response) {
  let videoChannel: VideoChannelModel
  let uri = search

  if (isWebfingerSearch) uri = await loadActorUrlOrGetFromWebfinger(search)

  if (isUserAbleToSearchRemoteURI(res)) {
    try {
      const actor = await getOrCreateActorAndServerAndModel(uri, true, true)
      videoChannel = actor.VideoChannel
    } catch (err) {
      logger.info('Cannot search remote video channel %s.', uri, { err })
    }
  } else {
    videoChannel = await VideoChannelModel.loadByUrlAndPopulateAccount(uri)
  }

  return res.json({
    total: videoChannel ? 1 : 0,
    data: videoChannel ? [ videoChannel.toFormattedJSON() ] : []
  })
}

function searchVideos (req: express.Request, res: express.Response) {
  const query: VideosSearchQuery = req.query
  const search = query.search
  if (search && (search.startsWith('http://') || search.startsWith('https://'))) {
    return searchVideoURI(search, res)
  }

  return searchVideosDB(query, res)
}

async function searchVideosDB (query: VideosSearchQuery, res: express.Response) {
  const options = Object.assign(query, {
    includeLocalVideos: true,
    nsfw: buildNSFWFilter(res, query.nsfw)
  })
  const resultList = await VideoModel.searchAndPopulateAccountAndServer(options)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function searchVideoURI (url: string, res: express.Response) {
  let video: VideoModel

  // Check if we can fetch a remote video with the URL
  if (isUserAbleToSearchRemoteURI(res)) {
    try {
      const syncParam = {
        likes: false,
        dislikes: false,
        shares: false,
        comments: false,
        thumbnail: true,
        refreshVideo: false
      }

      const result = await getOrCreateVideoAndAccountAndChannel(url, syncParam)
      video = result ? result.video : undefined
    } catch (err) {
      logger.info('Cannot search remote video %s.', url, { err })
    }
  } else {
    video = await VideoModel.loadByUrlAndPopulateAccount(url)
  }

  return res.json({
    total: video ? 1 : 0,
    data: video ? [ video.toFormattedJSON() ] : []
  })
}
