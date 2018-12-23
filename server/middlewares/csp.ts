import * as helmet from 'helmet'
import { CONFIG } from '../initializers/constants'

const baseDirectives = Object.assign({},
  {
    defaultSrc: ["'none'"], // by default, not specifying default-src = '*'
    connectSrc: ['*', 'data:'],
    mediaSrc: ["'self'", 'https:', 'blob:'],
    fontSrc: ["'self'", 'data:'],
    imgSrc: ["'self'", 'data:'],
    scriptSrc: ["'self' 'unsafe-inline' 'unsafe-eval'"],
    styleSrc: ["'self' 'unsafe-inline'"],
    objectSrc: ["'none'"], // only define to allow plugins, else let defaultSrc 'none' block it
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    manifestSrc: ["'self'"],
    frameSrc: ["'self'"], // instead of deprecated child-src / self because of test-embed
    workerSrc: ["'self'"] // instead of deprecated child-src
  },
  CONFIG.SERVICES['CSP-LOGGER'] ? { reportUri: CONFIG.SERVICES['CSP-LOGGER'] } : {},
  CONFIG.WEBSERVER.SCHEME === 'https' ? { upgradeInsecureRequests: true } : {}
)

const baseCSP = helmet.contentSecurityPolicy({
  directives: baseDirectives,
  browserSniff: false,
  reportOnly: true
})

const embedCSP = helmet.contentSecurityPolicy({
  directives: Object.assign(baseDirectives, {
    frameAncestors: ['*']
  }),
  browserSniff: false, // assumes a modern browser, but allows CDN in front
  reportOnly: true
})

// ---------------------------------------------------------------------------

export {
  baseCSP,
  embedCSP
}
