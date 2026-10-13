import { RunnerJobState } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { RunnerJobModel } from '@server/models/runner/runner-job.js'
import { getRunnerJobHandlerClass } from './job-handlers/index.js'
import { abortPendingCompletions } from './job-handlers/shared/pending-completions.js'

const logger = createLogger('runner')

// Abort pending runner job completions to give the jobs back to the runners, instead of letting the watchdog error them hours later
export async function abortAllPendingRunnerJobCompletions () {
  // From now on, the aborted completions cannot change anything: they would conflict with the runners that process the jobs again
  const { aborted, notAborted } = abortPendingCompletions()

  for (const { runnerJobUUID, abortable } of notAborted) {
    // Without commit points, the completion may already have made changes that cannot be undone: the watchdog will error the job
    if (!abortable) {
      logger.warn('Completion of runner job %s is interrupted by the shutdown and cannot be given back to the runners', runnerJobUUID)
    } else {
      logger.warn('Completion of runner job %s is interrupted by the shutdown after changes that cannot be undone', runnerJobUUID)
    }
  }

  for (const { runnerJobUUID } of aborted) {
    try {
      // The completion still uses its own instance
      const runnerJob = await RunnerJobModel.loadWithRunner(runnerJobUUID)
      if (runnerJob?.state !== RunnerJobState.COMPLETING) continue

      logger.info('Abort runner job %s (%s) whose completion is interrupted by the shutdown', runnerJob.uuid, runnerJob.type)

      const Handler = getRunnerJobHandlerClass(runnerJob)

      await new Handler().abort({
        runnerJob,
        abortNotSupportedErrorMessage: 'Job completion was interrupted by a server shutdown'
      })
    } catch (err) {
      logger.error('Cannot abort runner job %s whose completion is interrupted by the shutdown', runnerJobUUID, { err })
    }
  }
}
