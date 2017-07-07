// TODO: import from ES6 when retry typing file will include errorFilter function
import * as retry from 'async/retry'
import * as Promise from 'bluebird'

import { logger } from './logger'

type RetryTransactionWrapperOptions = { errorMessage: string, arguments?: any[] }
function retryTransactionWrapper (functionToRetry: (... args) => Promise<any>, options: RetryTransactionWrapperOptions) {
  const args = options.arguments ? options.arguments : []

  return transactionRetryer(
    function (callback) {
      functionToRetry.apply(this, args)
        .then(result => callback(null, result))
        .catch(err => callback(err))
    }
  )
  .catch(err => {
    // Do not throw the error, continue the process
    logger.error(options.errorMessage, err)
  })
}

function transactionRetryer (func: Function) {
  return new Promise((res, rej) => {
    retry({
      times: 5,

      errorFilter: function (err) {
        const willRetry = (err.name === 'SequelizeDatabaseError')
        logger.debug('Maybe retrying the transaction function.', { willRetry })
        return willRetry
      }
    }, func, function (err) {
      err ? rej(err) : res()
    })
  })
}

// ---------------------------------------------------------------------------

export {
  retryTransactionWrapper,
  transactionRetryer
}
