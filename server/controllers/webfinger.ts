import * as express from 'express'
import { asyncMiddleware } from '../middlewares'
import { webfingerValidator } from '../middlewares/validators'
import { ActorModel } from '../models/activitypub/actor'

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
  const actor = res.locals.actor as ActorModel

  const json = {
    subject: req.query.resource,
    aliases: [ actor.url ],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actor.url
      }
    ]
  }

  return res.json(json).end()
}
