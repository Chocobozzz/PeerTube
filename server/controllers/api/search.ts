import * as express from 'express'
import { isNSFWHidden } from '../../helpers/express-utils'
import { getFormattedObjects } from '../../helpers/utils'
import { VideoModel } from '../../models/video/video'
import {
  asyncMiddleware,
  optionalAuthenticate,
  paginationValidator,
  searchValidator,
  setDefaultPagination,
  setDefaultSearchSort,
  videosSearchSortValidator
} from '../../middlewares'

const searchRouter = express.Router()

searchRouter.get('/videos',
  paginationValidator,
  setDefaultPagination,
  videosSearchSortValidator,
  setDefaultSearchSort,
  optionalAuthenticate,
  searchValidator,
  asyncMiddleware(searchVideos)
)

// ---------------------------------------------------------------------------

export { searchRouter }

// ---------------------------------------------------------------------------

async function searchVideos (req: express.Request, res: express.Response) {
  const resultList = await VideoModel.searchAndPopulateAccountAndServer(
    req.query.search as string,
    req.query.start as number,
    req.query.count as number,
    req.query.sort as string,
    isNSFWHidden(res)
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
