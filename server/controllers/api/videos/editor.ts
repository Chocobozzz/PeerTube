import express from 'express'
import { createAnyReqFiles } from '@server/helpers/express-utils'
import { CONFIG } from '@server/initializers/config'
import { MIMETYPES } from '@server/initializers/constants'
import { JobQueue } from '@server/lib/job-queue'
import { buildTaskFileFieldname, getTaskFile } from '@server/lib/video-editor'
import {
  HttpStatusCode,
  VideoEditionTaskPayload,
  VideoEditorCreateEdition,
  VideoEditorTask,
  VideoEditorTaskCut,
  VideoEditorTaskIntro,
  VideoEditorTaskOutro,
  VideoEditorTaskWatermark,
  VideoState
} from '@shared/models'
import { asyncMiddleware, authenticate, videosEditorAddEditionValidator } from '../../../middlewares'

const editorRouter = express.Router()

const tasksFiles = createAnyReqFiles(
  MIMETYPES.VIDEO.MIMETYPE_EXT,
  CONFIG.STORAGE.TMP_DIR,
  (req: express.Request, file: Express.Multer.File, cb: (err: Error, result?: boolean) => void) => {
    const body = req.body as VideoEditorCreateEdition

    // Fetch array element
    const matches = file.fieldname.match(/tasks\[(\d+)\]/)
    if (!matches) return cb(new Error('Cannot find array element indice for ' + file.fieldname))

    const indice = parseInt(matches[1])
    const task = body.tasks[indice]

    if (!task) return cb(new Error('Cannot find array element of indice ' + indice + ' for ' + file.fieldname))

    if (
      [ 'add-intro', 'add-outro', 'add-watermark' ].includes(task.name) &&
      file.fieldname === buildTaskFileFieldname(indice)
    ) {
      return cb(null, true)
    }

    return cb(null, false)
  }
)

editorRouter.post('/:videoId/editor/edit',
  authenticate,
  tasksFiles,
  asyncMiddleware(videosEditorAddEditionValidator),
  asyncMiddleware(createEditionTasks)
)

// ---------------------------------------------------------------------------

export {
  editorRouter
}

// ---------------------------------------------------------------------------

async function createEditionTasks (req: express.Request, res: express.Response) {
  const files = req.files as Express.Multer.File[]
  const body = req.body as VideoEditorCreateEdition
  const video = res.locals.videoAll

  video.state = VideoState.TO_EDIT
  await video.save()

  const payload = {
    videoUUID: video.uuid,
    tasks: body.tasks.map((t, i) => buildTaskPayload(t, i, files))
  }

  JobQueue.Instance.createJob({ type: 'video-edition', payload })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

const taskPayloadBuilders: {
  [id in VideoEditorTask['name']]: (task: VideoEditorTask, indice?: number, files?: Express.Multer.File[]) => VideoEditionTaskPayload
} = {
  'add-intro': buildIntroOutroTask,
  'add-outro': buildIntroOutroTask,
  'cut': buildCutTask,
  'add-watermark': buildWatermarkTask
}

function buildTaskPayload (task: VideoEditorTask, indice: number, files: Express.Multer.File[]): VideoEditionTaskPayload {
  return taskPayloadBuilders[task.name](task, indice, files)
}

function buildIntroOutroTask (task: VideoEditorTaskIntro | VideoEditorTaskOutro, indice: number, files: Express.Multer.File[]) {
  return {
    name: task.name,
    options: {
      file: getTaskFile(files, indice).path
    }
  }
}

function buildCutTask (task: VideoEditorTaskCut) {
  return {
    name: task.name,
    options: {
      start: task.options.start,
      end: task.options.end
    }
  }
}

function buildWatermarkTask (task: VideoEditorTaskWatermark, indice: number, files: Express.Multer.File[]) {
  return {
    name: task.name,
    options: {
      file: getTaskFile(files, indice).path
    }
  }
}
