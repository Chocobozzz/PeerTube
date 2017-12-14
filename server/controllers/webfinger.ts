import * as express from 'express'
import { asyncMiddleware } from '../middlewares'
import { webfingerValidator } from '../middlewares/validators'
import { AccountModel } from '../models/account/account'

const webfingerRouter = express.Router()

webfingerRouter.get('/.well-known/webfinger',
  asyncMiddleware(webfingerValidator),
  webfingerController
)

// ---------------------------------------------------------------------------

export {
  webfingerRouter
}

// ---------------------------------------------------------------------------

function webfingerController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account = res.locals.account as AccountModel

  const json = {
    subject: req.query.resource,
    aliases: [ account.Actor.url ],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: account.Actor.url
      }
    ]
  }

  return res.json(json).end()
}
