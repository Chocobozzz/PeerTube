import { InboxManager } from '@server/lib/activitypub/inbox-manager'
import { RemoveDanglingResumableUploadsScheduler } from '@server/lib/schedulers/remove-dangling-resumable-uploads-scheduler'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'
import { SendDebugCommand } from '@shared/models'
import * as express from 'express'
import { UserRight } from '../../../../shared/models/users'
import { authenticate, ensureUserHasRight } from '../../../middlewares'

const debugRouter = express.Router()

debugRouter.get('/debug',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_DEBUG),
  getDebug
)

debugRouter.post('/debug/run-command',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_DEBUG),
  runCommand
)

// ---------------------------------------------------------------------------

export {
  debugRouter
}

// ---------------------------------------------------------------------------

function getDebug (req: express.Request, res: express.Response) {
  return res.json({
    ip: req.ip,
    activityPubMessagesWaiting: InboxManager.Instance.getActivityPubMessagesWaiting()
  })
}

async function runCommand (req: express.Request, res: express.Response) {
  const body: SendDebugCommand = req.body

  if (body.command === 'remove-dandling-resumable-uploads') {
    await RemoveDanglingResumableUploadsScheduler.Instance.execute()
  }

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}
