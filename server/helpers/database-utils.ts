// TODO: import from ES6 when retry typing file will include errorFilter function
import * as retry from 'async/retry'
import * as Bluebird from 'bluebird'
import { logger } from './logger'

type RetryTransactionWrapperOptions = { errorMessage: string, arguments?: any[] }
function retryTransactionWrapper (functionToRetry: (...args) => Promise<any> | Bluebird<any>, options: RetryTransactionWrapperOptions) {
  const args = options.arguments ? options.arguments : []

  return transactionRetryer(callback => {
    functionToRetry.apply(this, args)
        .then(result => callback(null, result))
        .catch(err => callback(err))
  })
  .catch(err => {
    logger.error(options.errorMessage, err)
    throw err
  })
}

function transactionRetryer (func: Function) {
  return new Promise((res, rej) => {
    retry({
      times: 5,

      errorFilter: err => {
        const willRetry = (err.name === 'SequelizeDatabaseError')
        logger.debug('Maybe retrying the transaction function.', { willRetry })
        return willRetry
      }
    }, func, (err, data) => err ? rej(err) : res(data))
  })
}

// ---------------------------------------------------------------------------

export {
  retryTransactionWrapper,
  transactionRetryer
}
