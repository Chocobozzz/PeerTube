import { HttpStatusCode } from '@peertube/peertube-models'
import { Awaitable } from '@peertube/peertube-typescript-utils'
import { isUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { isIdValid } from '@server/helpers/custom-validators/misc.js'
import { WatchedWordsSubscriptionModel } from '@server/models/watched-words/watched-words-subscription.js'
import { MAccountId } from '@server/types/models/index.js'
import express from 'express'
import { body, param } from 'express-validator'
import { areValidationErrors } from './shared/utils.js'

export function addWatchedWordsSubscriptionValidatorFactory (accountGetter: (res: express.Response) => Awaitable<MAccountId>) {
  return [
    body('url').custom(isUrlValid),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res)) return

      const account = await accountGetter(res)

      const existingSubscription = await WatchedWordsSubscriptionModel.loadByUrl({
        accountId: account.id,
        url: req.body.url
      })

      if (existingSubscription) {
        return res.fail({
          status: HttpStatusCode.CONFLICT_409,
          message: req.t('Subscription with URL {url} already exists', { url: req.body.url })
        })
      }

      return next()
    }
  ]
}

export function deleteWatchedWordsSubscriptionValidatorFactory (accountGetter: (res: express.Response) => Awaitable<MAccountId>) {
  return [
    param('id')
      .custom(isIdValid),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res)) return

      const account = await accountGetter(res)

      const subscription = await WatchedWordsSubscriptionModel.loadById(+req.params.id)
      if (!subscription || subscription.accountId !== account.id) {
        return res.fail({
          status: HttpStatusCode.NOT_FOUND_404,
          message: req.t('Watched words subscription not found')
        })
      }

      res.locals.watchedWordsSubscription = subscription

      return next()
    }
  ]
}
