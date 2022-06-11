import express from 'express'
import { InboxManager } from '@server/lib/activitypub/inbox-manager'
import { RemoveDanglingResumableUploadsScheduler } from '@server/lib/schedulers/remove-dangling-resumable-uploads-scheduler'
import { Debug, SendDebugCommand } from '@shared/models'
import { HttpStatusCode } from '../../../../shared/models/http/http-error-codes'
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
  } as Debug)
}

async function runCommand (req: express.Request, res: express.Response) {
  const body: SendDebugCommand = req.body

  if (body.command === 'remove-dandling-resumable-uploads') {
    await RemoveDanglingResumableUploadsScheduler.Instance.execute()
  }

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}
