import { contentSecurityPolicy } from 'helmet'
import { CONFIG } from '../initializers/config.js'

const baseDirectives = Object.assign({},
  {
    defaultSrc: [ '\'none\'' ], // by default, not specifying default-src = '*'
    connectSrc: [ '*', 'data:' ],
    mediaSrc: [ '\'self\'', 'https:', 'blob:' ],
    fontSrc: [ '\'self\'', 'data:' ],
    imgSrc: [ '\'self\'', 'data:', 'blob:' ],
    scriptSrc: [ '\'self\' \'unsafe-inline\' \'unsafe-eval\'', 'blob:' ],
    scriptSrcAttr: [ '\'unsafe-inline\'' ],
    styleSrc: [ '\'self\' \'unsafe-inline\'' ],
    objectSrc: [ '\'none\'' ], // only define to allow plugins, else let defaultSrc 'none' block it
    formAction: [ '\'self\'' ],
    frameAncestors: [ '\'none\'' ],
    baseUri: [ '\'self\'' ],
    manifestSrc: [ '\'self\'' ],
    frameSrc: [ '\'self\'' ], // instead of deprecated child-src / self because of test-embed
    workerSrc: [ '\'self\'', 'blob:' ] // instead of deprecated child-src
  },

  CONFIG.CSP.REPORT_URI
    ? { reportUri: CONFIG.CSP.REPORT_URI }
    : {},

  CONFIG.WEBSERVER.SCHEME === 'https'
    ? { upgradeInsecureRequests: [] }
    : {}
)

const baseCSP = contentSecurityPolicy({
  directives: baseDirectives,
  reportOnly: CONFIG.CSP.REPORT_ONLY
})

const embedCSP = contentSecurityPolicy({
  directives: Object.assign({}, baseDirectives, { frameAncestors: [ '*' ] }),
  reportOnly: CONFIG.CSP.REPORT_ONLY
})

// ---------------------------------------------------------------------------

export {
  baseCSP,
  embedCSP
}
