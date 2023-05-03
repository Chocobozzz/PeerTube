import { logger } from '@server/helpers/logger'
import { MVideoFullLight } from '@server/types/models'
import { getVideoStreamDuration } from '@shared/ffmpeg'
import { VideoStudioEditionPayload, VideoStudioTask } from '@shared/models'
import { remove } from 'fs-extra'

function buildTaskFileFieldname (indice: number, fieldName = 'file') {
  return `tasks[${indice}][options][${fieldName}]`
}

function getTaskFileFromReq (files: Express.Multer.File[], indice: number, fieldName = 'file') {
  return files.find(f => f.fieldname === buildTaskFileFieldname(indice, fieldName))
}

async function safeCleanupStudioTMPFiles (payload: VideoStudioEditionPayload) {
  for (const task of payload.tasks) {
    try {
      if (task.name === 'add-intro' || task.name === 'add-outro') {
        await remove(task.options.file)
      } else if (task.name === 'add-watermark') {
        await remove(task.options.file)
      }
    } catch (err) {
      logger.error('Cannot remove studio file', { err })
    }
  }
}

async function approximateIntroOutroAdditionalSize (video: MVideoFullLight, tasks: VideoStudioTask[], fileFinder: (i: number) => string) {
  let additionalDuration = 0

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]

    if (task.name !== 'add-intro' && task.name !== 'add-outro') continue

    const filePath = fileFinder(i)
    additionalDuration += await getVideoStreamDuration(filePath)
  }

  return (video.getMaxQualityFile().size / video.duration) * additionalDuration
}

export {
  approximateIntroOutroAdditionalSize,
  buildTaskFileFieldname,
  getTaskFileFromReq,
  safeCleanupStudioTMPFiles
}
