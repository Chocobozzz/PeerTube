import * as express from 'express'
import { sanitizeUrl } from '@server/helpers/core-utils'
import { doJSONRequest } from '@server/helpers/requests'
import { CONFIG } from '@server/initializers/config'
import { WEBSERVER } from '@server/initializers/constants'
import { Hooks } from '@server/lib/plugins/hooks'
import { buildMutedForSearchIndex, isSearchIndexSearch, isURISearch } from '@server/lib/search'
import { getServerActor } from '@server/models/application/application'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'
import { ResultList, VideoChannel } from '@shared/models'
import { VideoChannelsSearchQuery } from '../../../../shared/models/search'
import { isUserAbleToSearchRemoteURI } from '../../../helpers/express-utils'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { getOrCreateAPActor, loadActorUrlOrGetFromWebfinger } from '../../../lib/activitypub/actors'
import {
  asyncMiddleware,
  openapiOperationDoc,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSearchSort,
  videoChannelsListSearchValidator,
  videoChannelsSearchSortValidator
} from '../../../middlewares'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { MChannelAccountDefault } from '../../../types/models'

const searchChannelsRouter = express.Router()

searchChannelsRouter.get('/video-channels',
  openapiOperationDoc({ operationId: 'searchChannels' }),
  paginationValidator,
  setDefaultPagination,
  videoChannelsSearchSortValidator,
  setDefaultSearchSort,
  optionalAuthenticate,
  videoChannelsListSearchValidator,
  asyncMiddleware(searchVideoChannels)
)

// ---------------------------------------------------------------------------

export { searchChannelsRouter }

// ---------------------------------------------------------------------------

function searchVideoChannels (req: express.Request, res: express.Response) {
  const query: VideoChannelsSearchQuery = req.query
  const search = query.search

  const parts = search.split('@')

  // Handle strings like @toto@example.com
  if (parts.length === 3 && parts[0].length === 0) parts.shift()
  const isWebfingerSearch = parts.length === 2 && parts.every(p => p && !p.includes(' '))

  if (isURISearch(search) || isWebfingerSearch) return searchVideoChannelURI(search, isWebfingerSearch, res)

  // @username -> username to search in DB
  if (query.search.startsWith('@')) query.search = query.search.replace(/^@/, '')

  if (isSearchIndexSearch(query)) {
    return searchVideoChannelsIndex(query, res)
  }

  return searchVideoChannelsDB(query, res)
}

async function searchVideoChannelsIndex (query: VideoChannelsSearchQuery, res: express.Response) {
  const result = await buildMutedForSearchIndex(res)

  const body = await Hooks.wrapObject(Object.assign(query, result), 'filter:api.search.video-channels.index.list.params')

  const url = sanitizeUrl(CONFIG.SEARCH.SEARCH_INDEX.URL) + '/api/v1/search/video-channels'

  try {
    logger.debug('Doing video channels search index request on %s.', url, { body })

    const { body: searchIndexResult } = await doJSONRequest<ResultList<VideoChannel>>(url, { method: 'POST', json: body })
    const jsonResult = await Hooks.wrapObject(searchIndexResult, 'filter:api.search.video-channels.index.list.result')

    return res.json(jsonResult)
  } catch (err) {
    logger.warn('Cannot use search index to make video channels search.', { err })

    return res.fail({
      status: HttpStatusCode.INTERNAL_SERVER_ERROR_500,
      message: 'Cannot use search index to make video channels search'
    })
  }
}

async function searchVideoChannelsDB (query: VideoChannelsSearchQuery, res: express.Response) {
  const serverActor = await getServerActor()

  const apiOptions = await Hooks.wrapObject({
    actorId: serverActor.id,
    search: query.search,
    start: query.start,
    count: query.count,
    sort: query.sort
  }, 'filter:api.search.video-channels.local.list.params')

  const resultList = await Hooks.wrapPromiseFun(
    VideoChannelModel.searchForApi,
    apiOptions,
    'filter:api.search.video-channels.local.list.result'
  )

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
      const actor = await getOrCreateAPActor(uri, 'all', true, true)
      videoChannel = actor.VideoChannel
    } catch (err) {
      logger.info('Cannot search remote video channel %s.', uri, { err })
    }
  } else {
    videoChannel = await VideoChannelModel.loadByUrlAndPopulateAccount(sanitizeLocalUrl(uri))
  }

  return res.json({
    total: videoChannel ? 1 : 0,
    data: videoChannel ? [ videoChannel.toFormattedJSON() ] : []
  })
}

function sanitizeLocalUrl (url: string) {
  if (!url) return ''

  // Handle alternative channel URLs
  return url.replace(new RegExp('^' + WEBSERVER.URL + '/c/'), WEBSERVER.URL + '/video-channels/')
}
