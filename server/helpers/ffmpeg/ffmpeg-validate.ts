import ffmpeg from 'fluent-ffmpeg'
import { Job } from 'bull'
import { lTags } from '@server/lib/object-storage/shared'
import { logger } from '../logger'
import { runCommand } from './ffmpeg-commons'

async function checkValidity (options: {
  job: Job
  path: string
}) {
  logger.debug('Will check video validity.', { options, ...lTags() })

  let validationFailed = false

  const command = ffmpeg(options.path)
    .addOption('-loglevel', 'error')
    .addOption('-f', 'null')
    .output('/dev/null')
    .on('stderr', () => {
      if (validationFailed) {
        return command.kill('SIGKILL')
      }
      validationFailed = true
    })

  await runCommand({ command, job: options.job })

  if (validationFailed) {
    throw Error(`Video validation failed for file ${options.path}`)
  }
}

export {
  checkValidity
}
