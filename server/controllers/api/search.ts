import * as express from 'express'
import { buildNSFWFilter, isUserAbleToSearchRemoteURI } from '../../helpers/express-utils'
import { getFormattedObjects } from '../../helpers/utils'
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
import { getOrCreateActorAndServerAndModel } from '../../lib/activitypub/actor'
import { logger } from '../../helpers/logger'
import { VideoChannelModel } from '../../models/video/video-channel'
import { loadActorUrlOrGetFromWebfinger } from '../../helpers/webfinger'
import { MChannelAccountDefault, MVideoAccountLightBlacklistAllFiles } from '../../typings/models'
import { getServerActor } from '@server/models/application/application'
import { getOrCreateVideoAndAccountAndChannel } from '@server/lib/activitypub/videos'

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

  // Handle strings like @toto@example.com
  if (parts.length === 3 && parts[0].length === 0) parts.shift()
  const isWebfingerSearch = parts.length === 2 && parts.every(p => p && !p.includes(' '))

  if (isURISearch || isWebfingerSearch) return searchVideoChannelURI(search, isWebfingerSearch, res)

  // @username -> username to search in DB
  if (query.search.startsWith('@')) query.search = query.search.replace(/^@/, '')
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
  let videoChannel: MChannelAccountDefault
  let uri = search

  if (isWebfingerSearch) {
    try {
      uri = await loadActorUrlOrGetFromWebfinger(search)
    } catch (err) {
      logger.warn('Cannot load actor URL or get from webfinger.', { search, err })

      return res.json({ total: 0, data: [] })
    }
  }

  if (isUserAbleToSearchRemoteURI(res)) {
    try {
      const actor = await getOrCreateActorAndServerAndModel(uri, 'all', true, true)
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
    nsfw: buildNSFWFilter(res, query.nsfw),
    filter: query.filter,
    user: res.locals.oauth ? res.locals.oauth.token.User : undefined
  })
  const resultList = await VideoModel.searchAndPopulateAccountAndServer(options)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function searchVideoURI (url: string, res: express.Response) {
  let video: MVideoAccountLightBlacklistAllFiles

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

      const result = await getOrCreateVideoAndAccountAndChannel({ videoObject: url, syncParam })
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
