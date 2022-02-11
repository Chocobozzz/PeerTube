import { MVideoFullLight } from "@server/types/models"
import { getVideoStreamDuration } from "@shared/extra-utils"
import { VideoEditorTask } from "@shared/models"

function buildTaskFileFieldname (indice: number, fieldName = 'file') {
  return `tasks[${indice}][options][${fieldName}]`
}

function getTaskFile (files: Express.Multer.File[], indice: number, fieldName = 'file') {
  return files.find(f => f.fieldname === buildTaskFileFieldname(indice, fieldName))
}

async function approximateIntroOutroAdditionalSize (video: MVideoFullLight, tasks: VideoEditorTask[], fileFinder: (i: number) => string) {
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
  getTaskFile
}
