import * as express from 'express'
import { query } from 'express-validator'
import { join } from 'path'
import { isTestInstance } from '../../helpers/core-utils'
import { isIdOrUUIDValid } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { WEBSERVER } from '../../initializers/constants'
import { doesVideoExist } from '../../helpers/middlewares'

const urlShouldStartWith = WEBSERVER.SCHEME + '://' + join(WEBSERVER.HOST, 'videos', 'watch') + '/'
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

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking oembed parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    if (req.query.format !== undefined && req.query.format !== 'json') {
      return res.status(501)
                .json({ error: 'Requested format is not implemented on server.' })
                .end()
    }

    const url = req.query.url as string

    const startIsOk = url.startsWith(urlShouldStartWith)
    const matches = videoWatchRegex.exec(url)

    if (startIsOk === false || matches === null) {
      return res.status(400)
                .json({ error: 'Invalid url.' })
                .end()
    }

    const videoId = matches[1]
    if (isIdOrUUIDValid(videoId) === false) {
      return res.status(400)
                .json({ error: 'Invalid video id.' })
                .end()
    }

    if (!await doesVideoExist(videoId, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  oembedValidator
}
