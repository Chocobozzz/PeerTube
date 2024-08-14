import express from 'express'
import { sanitizeUrl } from '@server/helpers/core-utils.js'
import { pickSearchChannelQuery } from '@server/helpers/query.js'
import { doJSONRequest } from '@server/helpers/requests.js'
import { CONFIG } from '@server/initializers/config.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { findLatestAPRedirection } from '@server/lib/activitypub/activity.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { buildMutedForSearchIndex, isSearchIndexSearch, isURISearch } from '@server/lib/search.js'
import { getServerActor } from '@server/models/application/application.js'
import { HttpStatusCode, ResultList, VideoChannel, VideoChannelsSearchQueryAfterSanitize } from '@peertube/peertube-models'
import { isUserAbleToSearchRemoteURI } from '../../../helpers/express-utils.js'
import { logger } from '../../../helpers/logger.js'
import { getFormattedObjects } from '../../../helpers/utils.js'
import { getOrCreateAPActor, loadActorUrlOrGetFromWebfinger } from '../../../lib/activitypub/actors/index.js'
import {
  asyncMiddleware,
  openapiOperationDoc,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSearchSort,
  videoChannelsListSearchValidator,
  videoChannelsSearchSortValidator
} from '../../../middlewares/index.js'
import { VideoChannelModel } from '../../../models/video/video-channel.js'
import { MChannelAccountDefault } from '../../../types/models/index.js'
import { searchLocalUrl } from './shared/index.js'

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
  const query = pickSearchChannelQuery(req.query)
  const search = query.search || ''

  const parts = search.split('@')

  // Handle strings like @toto@example.com
  if (parts.length === 3 && parts[0].length === 0) parts.shift()
  const isWebfingerSearch = parts.length === 2 && parts.every(p => p && !p.includes(' '))

  if (isURISearch(search) || isWebfingerSearch) return searchVideoChannelURI(search, res)

  // @username -> username to search in DB
  if (search.startsWith('@')) query.search = search.replace(/^@/, '')

  if (isSearchIndexSearch(query)) {
    return searchVideoChannelsIndex(query, res)
  }

  return searchVideoChannelsDB(query, res)
}

async function searchVideoChannelsIndex (query: VideoChannelsSearchQueryAfterSanitize, res: express.Response) {
  const result = await buildMutedForSearchIndex(res)

  const body = await Hooks.wrapObject(Object.assign(query, result), 'filter:api.search.video-channels.index.list.params')

  const url = sanitizeUrl(CONFIG.SEARCH.SEARCH_INDEX.URL) + '/api/v1/search/video-channels'

  try {
    logger.debug('Doing video channels search index request on %s.', url, { body })

    const searchIndexResult = await doJSONRequest<ResultList<VideoChannel>>(url, { method: 'POST', json: body, preventSSRF: false })
    const jsonResult = await Hooks.wrapObject(searchIndexResult.body, 'filter:api.search.video-channels.index.list.result')

    return res.json(jsonResult)
  } catch (err) {
    logger.warn('Cannot use search index to make video channels search.', { err })

    return res.fail({
      status: HttpStatusCode.INTERNAL_SERVER_ERROR_500,
      message: 'Cannot use search index to make video channels search'
    })
  }
}

async function searchVideoChannelsDB (query: VideoChannelsSearchQueryAfterSanitize, res: express.Response) {
  const serverActor = await getServerActor()

  const apiOptions = await Hooks.wrapObject({
    ...query,

    actorId: serverActor.id
  }, 'filter:api.search.video-channels.local.list.params')

  const resultList = await Hooks.wrapPromiseFun(
    VideoChannelModel.searchForApi.bind(VideoChannelModel),
    apiOptions,
    'filter:api.search.video-channels.local.list.result'
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function searchVideoChannelURI (search: string, res: express.Response) {
  let videoChannel: MChannelAccountDefault
  let uri = search

  if (!isURISearch(search)) {
    try {
      uri = await loadActorUrlOrGetFromWebfinger(search)
    } catch (err) {
      logger.warn('Cannot load actor URL or get from webfinger.', { search, err })

      return res.json({ total: 0, data: [] })
    }
  }

  if (isUserAbleToSearchRemoteURI(res)) {
    try {
      const latestUri = await findLatestAPRedirection(uri)

      const actor = await getOrCreateAPActor(latestUri, 'all', true, true)
      videoChannel = actor.VideoChannel
    } catch (err) {
      logger.info('Cannot search remote video channel %s.', uri, { err })
    }
  } else {
    videoChannel = await searchLocalUrl(sanitizeLocalUrl(uri), url => VideoChannelModel.loadByUrlAndPopulateAccount(url))
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
