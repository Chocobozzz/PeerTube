import * as helmet from 'helmet'

const baseDirectives = {
  defaultSrc: ["'none'"], // by default, not specifying default-src = '*'
  connectSrc: ['*'],
  mediaSrc: ["'self'"],
  fontSrc: ["'self' data:"],
  imgSrc: ["'self' data:"],
  scriptSrc: ["'self' 'unsafe-inline'"],
  styleSrc: ["'self' 'unsafe-inline'"],
  // objectSrc: ["'none'"], // only define to allow plugins, else let defaultSrc 'none' block it
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  pluginTypes: ["'none'"],
  manifestSrc: ["'self'"],
  frameSrc: ["'self'"], // instead of deprecated child-src / self because of test-embed
  workerSrc: ["'self'"], // instead of deprecated child-src
  upgradeInsecureRequests: true
}

const baseCSP = helmet.contentSecurityPolicy({
  directives: baseDirectives,
  browserSniff: false
})

const embedCSP = helmet.contentSecurityPolicy({
  directives: Object.assign(baseDirectives, {
    frameAncestors: ['*']
  }),
  browserSniff: false // assumes a modern browser, but allows CDN in front
})

// ---------------------------------------------------------------------------

export {
  baseCSP,
  embedCSP
}
