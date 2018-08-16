import * as express from 'express'
import { buildNSFWFilter } from '../../helpers/express-utils'
import { getFormattedObjects } from '../../helpers/utils'
import { VideoModel } from '../../models/video/video'
import {
  asyncMiddleware,
  commonVideosFiltersValidator,
  optionalAuthenticate,
  paginationValidator,
  searchValidator,
  setDefaultPagination,
  setDefaultSearchSort,
  videosSearchSortValidator
} from '../../middlewares'
import { VideosSearchQuery } from '../../../shared/models/search'

const searchRouter = express.Router()

searchRouter.get('/videos',
  paginationValidator,
  setDefaultPagination,
  videosSearchSortValidator,
  setDefaultSearchSort,
  optionalAuthenticate,
  commonVideosFiltersValidator,
  searchValidator,
  asyncMiddleware(searchVideos)
)

// ---------------------------------------------------------------------------

export { searchRouter }

// ---------------------------------------------------------------------------

async function searchVideos (req: express.Request, res: express.Response) {
  const query: VideosSearchQuery = req.query

  const options = Object.assign(query, {
    includeLocalVideos: true,
    nsfw: buildNSFWFilter(res, query.nsfw)
  })
  const resultList = await VideoModel.searchAndPopulateAccountAndServer(options)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
