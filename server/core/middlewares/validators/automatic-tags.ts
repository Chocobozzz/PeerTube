import { CommentAutomaticTagPoliciesUpdate, VideoAutomaticTagPoliciesUpdate } from '@peertube/peertube-models'
import { isStringArray } from '@server/helpers/custom-validators/search.js'
import { AutomaticTagger } from '@server/lib/automatic-tags/automatic-tagger.js'
import { getServerAccount } from '@server/models/application/application.js'
import { MAccount } from '@server/types/models/index.js'
import express from 'express'
import { body, param } from 'express-validator'
import { doesAccountHandleExist } from './shared/accounts.js'
import { areValidationErrors } from './shared/utils.js'

export const manageAccountAutomaticTagsValidator = [
  param('accountName')
    .exists(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesAccountHandleExist({ handle: req.params.accountName, req, res, checkIsLocal: true, checkCanManage: true })) return

    return next()
  }
]

export const updateAutomaticTagPoliciesValidator = [
  ...manageAccountAutomaticTagsValidator,

  body('review')
    .custom(isStringArray).withMessage('Should have a valid review array'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const body = req.body as CommentAutomaticTagPoliciesUpdate

    if (!await checkTags({ account: res.locals.account, tags: body.review, req, res })) return

    return next()
  }
]

export const updateServerVideoAutomaticTagPoliciesValidator = [
  body('autoBlock')
    .custom(isStringArray).withMessage('Should have a valid autoBlock array'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const body = req.body as VideoAutomaticTagPoliciesUpdate

    const serverAccount = await getServerAccount()
    if (!await checkTags({ account: serverAccount, tags: body.autoBlock, req, res })) return

    return next()
  }
]

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function checkTags (options: {
  account: MAccount
  tags: string[]
  req: express.Request
  res: express.Response
}) {
  const { account, tags, req, res } = options

  const tagsObj = await AutomaticTagger.getAutomaticTagAvailable(account)
  const available = new Set(tagsObj.available.map(({ name }) => name))

  for (const name of tags) {
    if (!available.has(name)) {
      res.fail({ message: req.t(`{name} is not an available automatic tag`, { name }) })
      return false
    }
  }

  return true
}
