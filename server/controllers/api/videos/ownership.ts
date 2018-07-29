import * as express from 'express'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate, videosChangeOwnershipValidator } from '../../../middlewares'
import { AccountModel } from '../../../models/account/account'
import { VideoModel } from '../../../models/video/video'
import { VideoChangeOwnershipModel } from '../../../models/video/video-change-ownership'
import { VideoChangeOwnershipCreate } from '../../../../shared/models/videos'

const ownershipVideoRouter = express.Router()

ownershipVideoRouter.post('/:id/give-ownership',
  authenticate,
  asyncMiddleware(videosChangeOwnershipValidator),
  asyncRetryTransactionMiddleware(giveVideoOwnership)
)

// ---------------------------------------------------------------------------

export {
  ownershipVideoRouter
}

// ---------------------------------------------------------------------------

async function giveVideoOwnership (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.video as VideoModel
  const initiatorAccount = res.locals.oauth.token.User.Account as AccountModel
  const body: VideoChangeOwnershipCreate = req.body

  await sequelizeTypescript.transaction(async t => {
    const nextOwner = await AccountModel.findOne({ where: { name: body.username } })
    if (nextOwner) {
      const videoChangeOwnershipToCreate = {
        initiatorAccountId: initiatorAccount.id,
        nextOwnerAccountId: nextOwner.id,
        videoId: videoInstance.id
      }
      await VideoChangeOwnershipModel.create(videoChangeOwnershipToCreate, { transaction: t })

      logger.info('Ownership change for video %s created.', videoInstance.name)
      return res.type('json').status(204).end()
    } else {
      return res.type('json').status(400).end()
    }
  })
}
