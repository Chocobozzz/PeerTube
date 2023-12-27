import cors from 'cors'
import express from 'express'
import { join } from 'path'
import { asyncMiddleware, buildRateLimiter, handleStaticError, webfingerValidator } from '@server/middlewares/index.js'
import { root } from '@peertube/peertube-node-utils'
import { CONFIG } from '../initializers/config.js'
import { ROUTE_CACHE_LIFETIME, WEBSERVER } from '../initializers/constants.js'
import { cacheRoute } from '../middlewares/cache/cache.js'

const wellKnownRouter = express.Router()

const wellKnownRateLimiter = buildRateLimiter({
  windowMs: CONFIG.RATES_LIMIT.WELL_KNOWN.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.WELL_KNOWN.MAX
})

wellKnownRouter.use(cors())

wellKnownRouter.get('/.well-known/webfinger',
  wellKnownRateLimiter,
  asyncMiddleware(webfingerValidator),
  webfingerController
)

wellKnownRouter.get('/.well-known/security.txt',
  wellKnownRateLimiter,
  cacheRoute(ROUTE_CACHE_LIFETIME.SECURITYTXT),
  (_, res: express.Response) => {
    res.type('text/plain')
    return res.send(CONFIG.INSTANCE.SECURITYTXT)
  }
)

// nodeinfo service
wellKnownRouter.use('/.well-known/nodeinfo',
  wellKnownRateLimiter,
  cacheRoute(ROUTE_CACHE_LIFETIME.NODEINFO),
  (_, res: express.Response) => {
    return res.json({
      links: [
        {
          rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
          href: WEBSERVER.URL + '/nodeinfo/2.0.json'
        },
        {
          rel: 'https://www.w3.org/ns/activitystreams#Application',
          href: WEBSERVER.URL + '/accounts/peertube'
        }
      ]
    })
  }
)

// dnt-policy.txt service (see https://www.eff.org/dnt-policy)
wellKnownRouter.use('/.well-known/dnt-policy.txt',
  wellKnownRateLimiter,
  cacheRoute(ROUTE_CACHE_LIFETIME.DNT_POLICY),
  (_, res: express.Response) => {
    res.type('text/plain')

    return res.sendFile(join(root(), 'dist/core/static/dnt-policy/dnt-policy-1.0.txt'))
  }
)

// dnt service (see https://www.w3.org/TR/tracking-dnt/#status-resource)
wellKnownRouter.use('/.well-known/dnt/',
  wellKnownRateLimiter,
  (_, res: express.Response) => {
    res.json({ tracking: 'N' })
  }
)

wellKnownRouter.use('/.well-known/change-password',
  wellKnownRateLimiter,
  (_, res: express.Response) => {
    res.redirect('/my-account/settings')
  }
)

wellKnownRouter.use('/.well-known/host-meta',
  wellKnownRateLimiter,
  (_, res: express.Response) => {
    res.type('application/xml')

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">\n' +
      `  <Link rel="lrdd" type="application/xrd+xml" template="${WEBSERVER.URL}/.well-known/webfinger?resource={uri}"/>\n` +
      '</XRD>'

    res.send(xml).end()
  }
)

wellKnownRouter.use('/.well-known/',
  wellKnownRateLimiter,
  cacheRoute(ROUTE_CACHE_LIFETIME.WELL_KNOWN),
  express.static(CONFIG.STORAGE.WELL_KNOWN_DIR, { fallthrough: false }),
  handleStaticError
)

// ---------------------------------------------------------------------------

export {
  wellKnownRouter
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
      },
      {
        rel: 'http://ostatus.org/schema/1.0/subscribe',
        template: WEBSERVER.URL + '/remote-interaction?uri={uri}'
      }
    ]
  }

  return res.json(json)
}
