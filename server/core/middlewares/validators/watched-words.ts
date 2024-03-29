import { HttpStatusCode } from '@peertube/peertube-models'
import { Awaitable } from '@peertube/peertube-typescript-utils'
import { isIdValid } from '@server/helpers/custom-validators/misc.js'
import { areWatchedWordsValid, isWatchedWordListNameValid } from '@server/helpers/custom-validators/watched-words.js'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import { WatchedWordsListModel } from '@server/models/watched-words/watched-words-list.js'
import { MAccountId, MWatchedWordsList } from '@server/types/models/index.js'
import express from 'express'
import { ValidationChain, body, param } from 'express-validator'
import { doesAccountNameWithHostExist } from './shared/accounts.js'
import { checkUserCanManageAccount } from './shared/users.js'
import { areValidationErrors } from './shared/utils.js'

export const manageAccountWatchedWordsListValidator = [
  param('accountName')
    .exists(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesAccountNameWithHostExist(req.params.accountName, res)) return
    if (!checkUserCanManageAccount({ user: res.locals.oauth.token.User, account: res.locals.account, specialRight: null, res })) return

    return next()
  }
]

export function getWatchedWordsListValidatorFactory (accountGetter: (res: express.Response) => Awaitable<MAccountId>) {
  return [
    param('listId')
      .custom(isIdValid),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res)) return

      const watchedWordsList = await WatchedWordsListModel.load({ id: +req.params.listId, accountId: (await accountGetter(res)).id })
      if (!watchedWordsList) {
        return res.fail({
          status: HttpStatusCode.NOT_FOUND_404,
          message: 'Unknown watched words list id for this account'
        })
      }

      res.locals.watchedWordsList = watchedWordsList

      return next()
    }
  ]
}

function buildUpdateOrAddValidators ({ optional }: { optional: boolean }) {
  const makeOptionalIfNeeded = (chain: ValidationChain) => {
    if (optional) return chain.optional()

    return chain
  }

  return [
    makeOptionalIfNeeded(body('listName'))
      .trim()
      .custom(isWatchedWordListNameValid).withMessage(
        `Should have a list name between ` +
        `${CONSTRAINTS_FIELDS.WATCHED_WORDS.LIST_NAME.min} and ${CONSTRAINTS_FIELDS.WATCHED_WORDS.LIST_NAME.max} characters long`
      ),

    makeOptionalIfNeeded(body('words'))
      .custom(areWatchedWordsValid)
      .withMessage(
        `Should have an array of up to ${CONSTRAINTS_FIELDS.WATCHED_WORDS.WORDS.max} words between ` +
        `${CONSTRAINTS_FIELDS.WATCHED_WORDS.WORD.min} and ${CONSTRAINTS_FIELDS.WATCHED_WORDS.WORD.max} characters each`
      )
  ]
}

export function addWatchedWordsListValidatorFactory (accountGetter: (res: express.Response) => Awaitable<MAccountId>) {
  return [
    ...buildUpdateOrAddValidators({ optional: false }),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res)) return

      const listName = req.body.listName
      if (!await checkListNameIsUnique({ accountId: (await accountGetter(res)).id, listName, res })) return

      return next()
    }
  ]
}

export function updateWatchedWordsListValidatorFactory (accountGetter: (res: express.Response) => Awaitable<MAccountId>) {
  return [
    ...buildUpdateOrAddValidators({ optional: true }),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res)) return

      const currentList = res.locals.watchedWordsList
      const listName = req.body.listName
      if (listName && !await checkListNameIsUnique({ accountId: (await accountGetter(res)).id, listName, currentList, res })) return

      return next()
    }
  ]
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function checkListNameIsUnique (options: {
  accountId: number
  listName: string
  res: express.Response
  currentList?: MWatchedWordsList
}) {
  const { accountId, listName, currentList, res } = options

  const existing = await WatchedWordsListModel.loadByListName({ accountId, listName })
  if (existing && (!currentList || currentList.id !== existing.id)) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: `Watched words list with name ${listName} already exists`
    })

    return false
  }

  return true
}
