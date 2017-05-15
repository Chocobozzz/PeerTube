import { logger } from '../../../helpers'
import { checkErrors } from '../utils'

function signatureValidator (req, res, next) {
  req.checkBody('signature.host', 'Should have a signature host').isURL()
  req.checkBody('signature.signature', 'Should have a signature').notEmpty()

  logger.debug('Checking signature parameters', { parameters: { signature: req.body.signature } })

  checkErrors(req, res, next)
}

// ---------------------------------------------------------------------------

export {
  signatureValidator
}
