import { query } from 'express-validator/check'
import * as express from 'express'
import { join } from 'path'

import { checkErrors } from './utils'
import { CONFIG } from '../../initializers'
import { logger } from '../../helpers'
import { checkVideoExists, isVideoIdOrUUIDValid } from '../../helpers/custom-validators/videos'
import { isTestInstance } from '../../helpers/core-utils'

const urlShouldStartWith = CONFIG.WEBSERVER.SCHEME + '://' + join(CONFIG.WEBSERVER.HOST, 'videos', 'watch') + '/'
const videoWatchRegex = new RegExp('([^/]+)$')
const isURLOptions = {
  require_host: true,
  require_tld: true
}

// We validate 'localhost', so we don't have the top level domain
if (isTestInstance()) {
  isURLOptions.require_tld = false
}

const oembedValidator = [
  query('url').isURL(isURLOptions).withMessage('Should have a valid url'),
  query('maxwidth').optional().isInt().withMessage('Should have a valid max width'),
  query('maxheight').optional().isInt().withMessage('Should have a valid max height'),
  query('format').optional().isIn([ 'xml', 'json' ]).withMessage('Should have a valid format'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking oembed parameters', { parameters: req.query })

    checkErrors(req, res, () => {
      if (req.query.format !== undefined && req.query.format !== 'json') {
        return res.status(501)
                  .json({ error: 'Requested format is not implemented on server.' })
                  .end()
      }

      const startIsOk = req.query.url.startsWith(urlShouldStartWith)
      const matches = videoWatchRegex.exec(req.query.url)
      if (startIsOk === false || matches === null) {
        return res.status(400)
                  .json({ error: 'Invalid url.' })
                  .end()
      }

      const videoId = matches[1]
      if (isVideoIdOrUUIDValid(videoId) === false) {
        return res.status(400)
                  .json({ error: 'Invalid video id.' })
                  .end()
      }

      checkVideoExists(videoId, res, next)
    })
  }
]

// ---------------------------------------------------------------------------

export {
  oembedValidator
}
