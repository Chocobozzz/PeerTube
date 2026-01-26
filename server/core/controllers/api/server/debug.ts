import {
  Debug,
  HttpStatusCode,
  SendDebugCommand,
  SendDebugTestEmails,
  UserExportState,
  UserImportResultSummary,
  UserRegistrationState,
  UserRight
} from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { InboxManager } from '@server/lib/activitypub/inbox-manager.js'
import { Emailer } from '@server/lib/emailer.js'
import { RemoveDanglingResumableUploadsScheduler } from '@server/lib/schedulers/remove-dangling-resumable-uploads-scheduler.js'
import { RemoveExpiredUserExportsScheduler } from '@server/lib/schedulers/remove-expired-user-exports-scheduler.js'
import { UpdateVideosScheduler } from '@server/lib/schedulers/update-videos-scheduler.js'
import { VideoChannelSyncLatestScheduler } from '@server/lib/schedulers/video-channel-sync-latest-scheduler.js'
import { VideoViewsBufferScheduler } from '@server/lib/schedulers/video-views-buffer-scheduler.js'
import { VideoViewsManager } from '@server/lib/views/video-views-manager.js'
import express from 'express'
import { asyncMiddleware, authenticate, ensureUserHasRight } from '../../../middlewares/index.js'
import { RemoveOldViewsScheduler } from '@server/lib/schedulers/remove-old-views-scheduler.js'

const debugRouter = express.Router()

debugRouter.get(
  '/debug',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_DEBUG),
  getDebug
)

debugRouter.post(
  '/debug/run-command',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_DEBUG),
  asyncMiddleware(runCommand)
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
    'process-video-channel-sync-latest': () => VideoChannelSyncLatestScheduler.Instance.execute(),
    'process-remove-old-views': () => RemoveOldViewsScheduler.Instance.execute(),
    'test-emails': () => testEmails(req, res)
  }

  if (!processors[body.command]) {
    return res.fail({ message: 'Invalid command' })
  }

  await processors[body.command]()

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function testEmails (req: express.Request, res: express.Response) {
  const email = (req.body as SendDebugTestEmails).email

  if (!email) {
    return res.fail({ message: 'Email is required for test-emails command' })
  }

  if (!email.includes('@')) {
    return res.fail({ message: 'Invalid email format for test-emails command' })
  }

  const fakeUrl = WEBSERVER.URL + '/test'
  const language = CONFIG.INSTANCE.DEFAULT_LANGUAGE
  const to = { email, language }

  Emailer.Instance.addPasswordResetEmailJob({ username: 'test-username', to: email, language, resetPasswordUrl: fakeUrl })
  Emailer.Instance.addPasswordCreateEmailJob({ username: 'test-username', to: email, language, createPasswordUrl: fakeUrl })
  Emailer.Instance.addUserVerifyChangeEmailJob({ username: 'test-username', to: email, language, verifyEmailUrl: fakeUrl })

  {
    Emailer.Instance.addRegistrationVerifyEmailJob({
      username: 'test-username',
      isRegistrationRequest: true,
      to: email,
      language,
      verifyEmailUrl: fakeUrl
    })
    Emailer.Instance.addRegistrationVerifyEmailJob({
      username: 'test-username',
      isRegistrationRequest: false,
      to: email,
      language,
      verifyEmailUrl: fakeUrl
    })
  }

  {
    const user = { username: 'test-username', email, language }

    Emailer.Instance.addUserBlockJob({ ...user, blocked: true, reason: 'Test reason for blocking' })
    Emailer.Instance.addUserBlockJob({ ...user, blocked: false, reason: 'Test reason for blocking' })
    Emailer.Instance.addUserBlockJob({ ...user, blocked: true })
    Emailer.Instance.addUserBlockJob({ ...user, blocked: false })
  }

  Emailer.Instance.addContactFormJob({ body: 'test contact form', fromEmail: email, fromName: 'Test User', subject: 'Test Subject' })

  {
    Emailer.Instance.addUserRegistrationRequestProcessedJob({
      username: 'test-username',
      state: UserRegistrationState.ACCEPTED,
      email,
      moderationResponse: 'Test moderation response'
    })
    Emailer.Instance.addUserRegistrationRequestProcessedJob({
      username: 'test-username',
      state: UserRegistrationState.REJECTED,
      email,
      moderationResponse: 'Test moderation response'
    })
  }

  {
    await Emailer.Instance.addUserExportCompletedOrErroredJob({ error: 'error', state: UserExportState.ERRORED, userId: 1 }, to)
    await Emailer.Instance.addUserExportCompletedOrErroredJob({ error: null, state: UserExportState.COMPLETED, userId: 1 }, to)
  }

  await Emailer.Instance.addUserImportErroredJob({ error: 'Test error', userId: 1 }, to)

  {
    const summary = {
      success: 1,
      duplicates: 2,
      errors: 3
    }
    const resultSummary: UserImportResultSummary = {
      stats: {
        blocklist: summary,
        channels: summary,
        likes: summary,
        dislikes: summary,
        following: summary,
        videoPlaylists: summary,
        videos: summary,
        account: summary,
        userSettings: summary,
        userVideoHistory: summary,
        watchedWordsLists: summary,
        commentAutoTagPolicies: summary
      }
    }

    await Emailer.Instance.addUserImportSuccessJob({ resultSummary, userId: 1 }, to)
  }

  {
    const user = { username: 'test-username', email, language }

    Emailer.Instance.addUserBlockJob({ ...user, blocked: true, reason: 'Test reason for blocking' })
    Emailer.Instance.addUserBlockJob({ ...user, blocked: false })
  }

  logger.info(`Sent test email to ${email}`)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
