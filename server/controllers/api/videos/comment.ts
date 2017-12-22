// import * as express from 'express'
// import { logger, getFormattedObjects } from '../../../helpers'
// import {
//   authenticate,
//   ensureUserHasRight,
//   videosBlacklistAddValidator,
//   videosBlacklistRemoveValidator,
//   paginationValidator,
//   blacklistSortValidator,
//   setBlacklistSort,
//   setPagination,
//   asyncMiddleware
// } from '../../../middlewares'
// import { BlacklistedVideo, UserRight } from '../../../../shared'
// import { VideoBlacklistModel } from '../../../models/video/video-blacklist'
//
// const videoCommentRouter = express.Router()
//
// videoCommentRouter.get('/:videoId/comment',
//   authenticate,
//   ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
//   asyncMiddleware(listVideoCommentsThreadsValidator),
//   asyncMiddleware(listVideoCommentsThreads)
// )
//
// videoCommentRouter.post('/:videoId/comment',
//   authenticate,
//   ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
//   asyncMiddleware(videosBlacklistAddValidator),
//   asyncMiddleware(addVideoToBlacklist)
// )
//
// videoCommentRouter.get('/blacklist',
//   authenticate,
//   ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
//   paginationValidator,
//   blacklistSortValidator,
//   setBlacklistSort,
//   setPagination,
//   asyncMiddleware(listBlacklist)
// )
//
// videoCommentRouter.delete('/:videoId/blacklist',
//   authenticate,
//   ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
//   asyncMiddleware(videosBlacklistRemoveValidator),
//   asyncMiddleware(removeVideoFromBlacklistController)
// )
//
// // ---------------------------------------------------------------------------
//
// export {
//   videoCommentRouter
// }
//
// // ---------------------------------------------------------------------------
//
// async function addVideoToBlacklist (req: express.Request, res: express.Response, next: express.NextFunction) {
//   const videoInstance = res.locals.video
//
//   const toCreate = {
//     videoId: videoInstance.id
//   }
//
//   await VideoBlacklistModel.create(toCreate)
//   return res.type('json').status(204).end()
// }
//
// async function listBlacklist (req: express.Request, res: express.Response, next: express.NextFunction) {
//   const resultList = await VideoBlacklistModel.listForApi(req.query.start, req.query.count, req.query.sort)
//
//   return res.json(getFormattedObjects<BlacklistedVideo, VideoBlacklistModel>(resultList.data, resultList.total))
// }
//
// async function removeVideoFromBlacklistController (req: express.Request, res: express.Response, next: express.NextFunction) {
//   const blacklistedVideo = res.locals.blacklistedVideo as VideoBlacklistModel
//
//   try {
//     await blacklistedVideo.destroy()
//
//     logger.info('Video %s removed from blacklist.', res.locals.video.uuid)
//
//     return res.sendStatus(204)
//   } catch (err) {
//     logger.error('Some error while removing video %s from blacklist.', res.locals.video.uuid, err)
//     throw err
//   }
// }
