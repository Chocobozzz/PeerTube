import {
  AutomaticTagPolicy,
  AutomaticTagPolicyType,
  CommentAutomaticTagPoliciesUpdate,
  HttpStatusCode,
  UserRight,
  VideoAutomaticTagPoliciesUpdate
} from '@peertube/peertube-models'
import { auditLog, buildAutomaticTagPolicyAuditEntity, getAuditActorFromRes } from '@server/lib/audit-log/index.js'
import { AutomaticTagger } from '@server/lib/automatic-tags/automatic-tagger.js'
import { setAccountAutomaticTagsPolicy } from '@server/lib/automatic-tags/automatic-tags.js'
import {
  manageAccountAutomaticTagsValidator,
  updateAutomaticTagPoliciesValidator,
  updateServerVideoAutomaticTagPoliciesValidator
} from '@server/middlewares/validators/automatic-tags.js'
import { AccountAutomaticTagPolicyModel } from '@server/models/automatic-tag/account-automatic-tag-policy.js'
import { getServerAccount } from '@server/models/application/application.js'
import { MAccountId } from '@server/types/models/index.js'
import express from 'express'
import { apiRateLimiter, asyncMiddleware, authenticate, ensureUserHasRight } from '../../middlewares/index.js'

const automaticTagRouter = express.Router()

automaticTagRouter.use(apiRateLimiter)

automaticTagRouter.get(
  '/policies/accounts/:accountName/comments',
  authenticate,
  asyncMiddleware(manageAccountAutomaticTagsValidator),
  asyncMiddleware(getAutomaticTagPolicies)
)

automaticTagRouter.put(
  '/policies/accounts/:accountName/comments',
  authenticate,
  asyncMiddleware(manageAccountAutomaticTagsValidator),
  asyncMiddleware(updateAutomaticTagPoliciesValidator),
  asyncMiddleware(updateAutomaticTagPolicies)
)

// ---------------------------------------------------------------------------

automaticTagRouter.get(
  '/policies/server/videos',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_INSTANCE_AUTO_TAGS),
  asyncMiddleware(getServerVideoAutomaticTagPolicies)
)

automaticTagRouter.put(
  '/policies/server/videos',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_INSTANCE_AUTO_TAGS),
  asyncMiddleware(updateServerVideoAutomaticTagPoliciesValidator),
  asyncMiddleware(updateServerVideoAutomaticTagPolicies)
)

// ---------------------------------------------------------------------------

automaticTagRouter.get(
  '/accounts/:accountName/available',
  authenticate,
  asyncMiddleware(manageAccountAutomaticTagsValidator),
  asyncMiddleware(getAccountAutomaticTagAvailable)
)

automaticTagRouter.get(
  '/server/available',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_INSTANCE_AUTO_TAGS),
  asyncMiddleware(getServerAutomaticTagAvailable)
)

// ---------------------------------------------------------------------------

export {
  automaticTagRouter
}

// ---------------------------------------------------------------------------

async function getAutomaticTagPolicies (req: express.Request, res: express.Response) {
  const result = await AutomaticTagger.getAutomaticTagPolicies(res.locals.account)

  return res.json(result)
}

async function updateAutomaticTagPolicies (req: express.Request, res: express.Response) {
  await updatePolicy({
    res,
    account: res.locals.account,
    policy: AutomaticTagPolicy.REVIEW_COMMENT,
    tags: (req.body as CommentAutomaticTagPoliciesUpdate).review
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function getAccountAutomaticTagAvailable (req: express.Request, res: express.Response) {
  const result = await AutomaticTagger.getAutomaticTagAvailable(res.locals.account)

  return res.json(result)
}

async function getServerAutomaticTagAvailable (req: express.Request, res: express.Response) {
  const result = await AutomaticTagger.getAutomaticTagAvailable(await getServerAccount())

  return res.json(result)
}

async function getServerVideoAutomaticTagPolicies (req: express.Request, res: express.Response) {
  const serverAccount = await getServerAccount()
  const result = await AutomaticTagger.getVideoAutomaticTagPolicies(serverAccount)

  return res.json(result)
}

async function updateServerVideoAutomaticTagPolicies (req: express.Request, res: express.Response) {
  const serverAccount = await getServerAccount()

  await updatePolicy({
    res,
    account: serverAccount,
    policy: AutomaticTagPolicy.AUTO_BLACKLIST_VIDEO,
    tags: (req.body as VideoAutomaticTagPoliciesUpdate).autoBlock
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

// ---------------------------------------------------------------------------

async function updatePolicy (options: {
  res: express.Response
  account: MAccountId
  policy: AutomaticTagPolicyType
  tags: string[]
}) {
  const { res, account, policy, tags } = options

  const oldPolicyAuditEntity = await auditLog.snapshot(async () => {
    const oldTags = (await AccountAutomaticTagPolicyModel.listOfAccount(account))
      .filter(p => p.policy === policy)
      .map(p => p.name)

    return buildAutomaticTagPolicyAuditEntity({ accountId: account.id, policy, tags: oldTags })
  })

  await setAccountAutomaticTagsPolicy({ account, policy, tags })

  auditLog.update(
    getAuditActorFromRes(res),
    () => buildAutomaticTagPolicyAuditEntity({ accountId: account.id, policy, tags }),
    oldPolicyAuditEntity
  )
}
