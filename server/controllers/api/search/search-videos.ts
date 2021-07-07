import * as express from 'express'
import { sanitizeUrl } from '@server/helpers/core-utils'
import { doJSONRequest } from '@server/helpers/requests'
import { CONFIG } from '@server/initializers/config'
import { WEBSERVER } from '@server/initializers/constants'
import { getOrCreateAPVideo } from '@server/lib/activitypub/videos'
import { Hooks } from '@server/lib/plugins/hooks'
import { buildMutedForSearchIndex, isSearchIndexSearch, isURISearch } from '@server/lib/search'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'
import { ResultList, Video } from '@shared/models'
import { VideosSearchQuery } from '../../../../shared/models/search'
import { buildNSFWFilter, isUserAbleToSearchRemoteURI } from '../../../helpers/express-utils'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import {
  asyncMiddleware,
  commonVideosFiltersValidator,
  openapiOperationDoc,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSearchSort,
  videosSearchSortValidator,
  videosSearchValidator
} from '../../../middlewares'
import { VideoModel } from '../../../models/video/video'
import { MVideoAccountLightBlacklistAllFiles } from '../../../types/models'

const searchVideosRouter = express.Router()

searchVideosRouter.get('/videos',
  openapiOperationDoc({ operationId: 'searchVideos' }),
  paginationValidator,
  setDefaultPagination,
  videosSearchSortValidator,
  setDefaultSearchSort,
  optionalAuthenticate,
  commonVideosFiltersValidator,
  videosSearchValidator,
  asyncMiddleware(searchVideos)
)

// ---------------------------------------------------------------------------

export { searchVideosRouter }

// ---------------------------------------------------------------------------

function searchVideos (req: express.Request, res: express.Response) {
  const query: VideosSearchQuery = req.query
  const search = query.search

  if (isURISearch(search)) {
    return searchVideoURI(search, res)
  }

  if (isSearchIndexSearch(query)) {
    return searchVideosIndex(query, res)
  }

  return searchVideosDB(query, res)
}

async function searchVideosIndex (query: VideosSearchQuery, res: express.Response) {
  const result = await buildMutedForSearchIndex(res)

  let body: VideosSearchQuery = Object.assign(query, result)

  // Use the default instance NSFW policy if not specified
  if (!body.nsfw) {
    const nsfwPolicy = res.locals.oauth
      ? res.locals.oauth.token.User.nsfwPolicy
      : CONFIG.INSTANCE.DEFAULT_NSFW_POLICY

    body.nsfw = nsfwPolicy === 'do_not_list'
      ? 'false'
      : 'both'
  }

  body = await Hooks.wrapObject(body, 'filter:api.search.videos.index.list.params')

  const url = sanitizeUrl(CONFIG.SEARCH.SEARCH_INDEX.URL) + '/api/v1/search/videos'

  try {
    logger.debug('Doing videos search index request on %s.', url, { body })

    const { body: searchIndexResult } = await doJSONRequest<ResultList<Video>>(url, { method: 'POST', json: body })
    const jsonResult = await Hooks.wrapObject(searchIndexResult, 'filter:api.search.videos.index.list.result')

    return res.json(jsonResult)
  } catch (err) {
    logger.warn('Cannot use search index to make video search.', { err })

    return res.fail({
      status: HttpStatusCode.INTERNAL_SERVER_ERROR_500,
      message: 'Cannot use search index to make video search'
    })
  }
}

async function searchVideosDB (query: VideosSearchQuery, res: express.Response) {
  const apiOptions = await Hooks.wrapObject(Object.assign(query, {
    includeLocalVideos: true,
    nsfw: buildNSFWFilter(res, query.nsfw),
    filter: query.filter,
    user: res.locals.oauth ? res.locals.oauth.token.User : undefined
  }), 'filter:api.search.videos.local.list.params')

  const resultList = await Hooks.wrapPromiseFun(
    VideoModel.searchAndPopulateAccountAndServer,
    apiOptions,
    'filter:api.search.videos.local.list.result'
  )

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

      const result = await getOrCreateAPVideo({ videoObject: url, syncParam })
      video = result ? result.video : undefined
    } catch (err) {
      logger.info('Cannot search remote video %s.', url, { err })
    }
  } else {
    video = await VideoModel.loadByUrlAndPopulateAccount(sanitizeLocalUrl(url))
  }

  return res.json({
    total: video ? 1 : 0,
    data: video ? [ video.toFormattedJSON() ] : []
  })
}

function sanitizeLocalUrl (url: string) {
  if (!url) return ''

  // Handle alternative video URLs
  return url.replace(new RegExp('^' + WEBSERVER.URL + '/w/'), WEBSERVER.URL + '/videos/watch/')
}
