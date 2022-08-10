import express from 'express'
import { InboxManager } from '@server/lib/activitypub/inbox-manager'
import { RemoveDanglingResumableUploadsScheduler } from '@server/lib/schedulers/remove-dangling-resumable-uploads-scheduler'
import { VideoViewsBufferScheduler } from '@server/lib/schedulers/video-views-buffer-scheduler'
import { VideoViewsManager } from '@server/lib/views/video-views-manager'
import { Debug, SendDebugCommand } from '@shared/models'
import { HttpStatusCode } from '../../../../shared/models/http/http-error-codes'
import { UserRight } from '../../../../shared/models/users'
import { authenticate, ensureUserHasRight } from '../../../middlewares'
import { VideoChannelSyncLatestScheduler } from '@server/lib/schedulers/video-channel-sync-latest-scheduler'

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

  const processors: { [id in SendDebugCommand['command']]: () => Promise<any> } = {
    'remove-dandling-resumable-uploads': () => RemoveDanglingResumableUploadsScheduler.Instance.execute(),
    'process-video-views-buffer': () => VideoViewsBufferScheduler.Instance.execute(),
    'process-video-viewers': () => VideoViewsManager.Instance.processViewerStats(),
    'process-video-channel-sync-latest': () => VideoChannelSyncLatestScheduler.Instance.execute()
  }

  await processors[body.command]()

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}
