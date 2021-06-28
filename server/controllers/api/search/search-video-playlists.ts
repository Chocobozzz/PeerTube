import * as express from 'express'
import { sanitizeUrl } from '@server/helpers/core-utils'
import { isUserAbleToSearchRemoteURI } from '@server/helpers/express-utils'
import { logger } from '@server/helpers/logger'
import { doJSONRequest } from '@server/helpers/requests'
import { getFormattedObjects } from '@server/helpers/utils'
import { CONFIG } from '@server/initializers/config'
import { getOrCreateAPVideoPlaylist } from '@server/lib/activitypub/playlists/get'
import { Hooks } from '@server/lib/plugins/hooks'
import { buildMutedForSearchIndex, isSearchIndexSearch, isURISearch } from '@server/lib/search'
import { getServerActor } from '@server/models/application/application'
import { VideoPlaylistModel } from '@server/models/video/video-playlist'
import { MVideoPlaylistFullSummary } from '@server/types/models'
import { HttpStatusCode } from '@shared/core-utils'
import { ResultList, VideoPlaylist, VideoPlaylistsSearchQuery } from '@shared/models'
import {
  asyncMiddleware,
  openapiOperationDoc,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSearchSort,
  videoPlaylistsListSearchValidator,
  videoPlaylistsSearchSortValidator
} from '../../../middlewares'
import { WEBSERVER } from '@server/initializers/constants'

const searchPlaylistsRouter = express.Router()

searchPlaylistsRouter.get('/video-playlists',
  openapiOperationDoc({ operationId: 'searchPlaylists' }),
  paginationValidator,
  setDefaultPagination,
  videoPlaylistsSearchSortValidator,
  setDefaultSearchSort,
  optionalAuthenticate,
  videoPlaylistsListSearchValidator,
  asyncMiddleware(searchVideoPlaylists)
)

// ---------------------------------------------------------------------------

export { searchPlaylistsRouter }

// ---------------------------------------------------------------------------

function searchVideoPlaylists (req: express.Request, res: express.Response) {
  const query: VideoPlaylistsSearchQuery = req.query
  const search = query.search

  if (isURISearch(search)) return searchVideoPlaylistsURI(search, res)

  if (isSearchIndexSearch(query)) {
    return searchVideoPlaylistsIndex(query, res)
  }

  return searchVideoPlaylistsDB(query, res)
}

async function searchVideoPlaylistsIndex (query: VideoPlaylistsSearchQuery, res: express.Response) {
  const result = await buildMutedForSearchIndex(res)

  const body = await Hooks.wrapObject(Object.assign(query, result), 'filter:api.search.video-playlists.index.list.params')

  const url = sanitizeUrl(CONFIG.SEARCH.SEARCH_INDEX.URL) + '/api/v1/search/video-playlists'

  try {
    logger.debug('Doing video playlists search index request on %s.', url, { body })

    const { body: searchIndexResult } = await doJSONRequest<ResultList<VideoPlaylist>>(url, { method: 'POST', json: body })
    const jsonResult = await Hooks.wrapObject(searchIndexResult, 'filter:api.search.video-playlists.index.list.result')

    return res.json(jsonResult)
  } catch (err) {
    logger.warn('Cannot use search index to make video playlists search.', { err })

    return res.fail({
      status: HttpStatusCode.INTERNAL_SERVER_ERROR_500,
      message: 'Cannot use search index to make video playlists search'
    })
  }
}

async function searchVideoPlaylistsDB (query: VideoPlaylistsSearchQuery, res: express.Response) {
  const serverActor = await getServerActor()

  const apiOptions = await Hooks.wrapObject({
    followerActorId: serverActor.id,
    search: query.search,
    start: query.start,
    count: query.count,
    sort: query.sort
  }, 'filter:api.search.video-playlists.local.list.params')

  const resultList = await Hooks.wrapPromiseFun(
    VideoPlaylistModel.searchForApi,
    apiOptions,
    'filter:api.search.video-playlists.local.list.result'
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function searchVideoPlaylistsURI (search: string, res: express.Response) {
  let videoPlaylist: MVideoPlaylistFullSummary

  if (isUserAbleToSearchRemoteURI(res)) {
    try {
      videoPlaylist = await getOrCreateAPVideoPlaylist(search)
    } catch (err) {
      logger.info('Cannot search remote video playlist %s.', search, { err })
    }
  } else {
    videoPlaylist = await VideoPlaylistModel.loadByUrlWithAccountAndChannelSummary(sanitizeLocalUrl(search))
  }

  return res.json({
    total: videoPlaylist ? 1 : 0,
    data: videoPlaylist ? [ videoPlaylist.toFormattedJSON() ] : []
  })
}

function sanitizeLocalUrl (url: string) {
  if (!url) return ''

  // Handle alternative channel URLs
  return url.replace(new RegExp('^' + WEBSERVER.URL + '/videos/watch/playlist/'), WEBSERVER.URL + '/video-playlists/')
            .replace(new RegExp('^' + WEBSERVER.URL + '/w/p/'), WEBSERVER.URL + '/video-playlists/')
}
