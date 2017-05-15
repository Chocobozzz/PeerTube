import { checkErrors } from './utils'
import { logger } from '../../helpers'

function paginationValidator (req, res, next) {
  req.checkQuery('start', 'Should have a number start').optional().isInt()
  req.checkQuery('count', 'Should have a number count').optional().isInt()

  logger.debug('Checking pagination parameters', { parameters: req.query })

  checkErrors(req, res, next)
}

// ---------------------------------------------------------------------------

export {
  paginationValidator
}
