import * as express from 'express'

import { CONFIG, PREVIEWS_SIZE, EMBED_SIZE } from '../initializers'
import { oembedValidator } from '../middlewares'
import { VideoInstance } from '../models'
import { webfingerValidator } from '../middlewares/validators/webfinger'
import { AccountInstance } from '../models/account/account-interface'

const webfingerRouter = express.Router()

webfingerRouter.get('/.well-known/webfinger',
  webfingerValidator,
  webfingerController
)

// ---------------------------------------------------------------------------

export {
  webfingerRouter
}

// ---------------------------------------------------------------------------

function webfingerController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountInstance = res.locals.account

  const json = {
    subject: req.query.resource,
    aliases: [ account.url ],
    links: [
      {
        rel: 'self',
        href: account.url
      }
    ]
  }

  return res.json(json).end()
}
