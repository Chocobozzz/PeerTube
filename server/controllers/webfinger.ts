import * as express from 'express'
import { asyncMiddleware } from '../middlewares'
import { webfingerValidator } from '../middlewares/validators'

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
  
  res.set('Access-Control-Allow-Origin', '*')

  return res.json(json)
}
