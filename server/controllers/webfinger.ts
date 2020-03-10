import * as cors from 'cors'
import * as express from 'express'
import { asyncMiddleware } from '../middlewares'
import { webfingerValidator } from '../middlewares/validators'

const webfingerRouter = express.Router()

webfingerRouter.use(cors())

webfingerRouter.get('/.well-known/webfinger',
  asyncMiddleware(webfingerValidator),
  webfingerController
)

// ---------------------------------------------------------------------------

export {
  webfingerRouter
}

// ---------------------------------------------------------------------------

function webfingerController (req: express.Request, res: express.Response) {
  const actor = res.locals.actorUrl

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

  return res.json(json)
}
