import ffmpeg from 'fluent-ffmpeg'
import { Job } from 'bull'
import { lTags } from '@server/lib/object-storage/shared'
import { logger } from '../logger'
import { runCommand } from './ffmpeg-commons'

async function validateVideoFile (options: {
  job?: Job
  path: string
}) {
  logger.debug('Will validate video file.', { options, ...lTags() })

  let stderr = ''
  const command = ffmpeg(options.path)
    .addOption('-max_muxing_queue_size', '1024')
    .addOption('-loglevel', 'error')
    .addOption('-f', 'null')
    .output('/dev/null')
    .on('stderr', (s) => {
      stderr += s
      return command.kill('SIGKILL')
    })

  try {
    await runCommand({ command, job: options.job })
  } catch (err) {
    throw Error(`Video validation failed for file ${options.path}: ${stderr}`)
  }
}

export {
  validateVideoFile
}
