import express from 'express'
import { Debug, HttpStatusCode, SendDebugCommand, UserRight } from '@peertube/peertube-models'
import { InboxManager } from '@server/lib/activitypub/inbox-manager.js'
import { RemoveDanglingResumableUploadsScheduler } from '@server/lib/schedulers/remove-dangling-resumable-uploads-scheduler.js'
import { UpdateVideosScheduler } from '@server/lib/schedulers/update-videos-scheduler.js'
import { VideoChannelSyncLatestScheduler } from '@server/lib/schedulers/video-channel-sync-latest-scheduler.js'
import { VideoViewsBufferScheduler } from '@server/lib/schedulers/video-views-buffer-scheduler.js'
import { VideoViewsManager } from '@server/lib/views/video-views-manager.js'
import { authenticate, ensureUserHasRight } from '../../../middlewares/index.js'
import { RemoveExpiredUserExportsScheduler } from '@server/lib/schedulers/remove-expired-user-exports-scheduler.js'

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
    'remove-expired-user-exports': () => RemoveExpiredUserExportsScheduler.Instance.execute(),
    'process-video-views-buffer': () => VideoViewsBufferScheduler.Instance.execute(),
    'process-video-viewers': () => VideoViewsManager.Instance.processViewerStats(),
    'process-update-videos-scheduler': () => UpdateVideosScheduler.Instance.execute(),
    'process-video-channel-sync-latest': () => VideoChannelSyncLatestScheduler.Instance.execute()
  }

  if (!processors[body.command]) {
    return res.fail({ message: 'Invalid command' })
  }

  await processors[body.command]()

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}
