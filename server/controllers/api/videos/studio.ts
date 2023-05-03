import Bluebird from 'bluebird'
import express from 'express'
import { move } from 'fs-extra'
import { basename, join } from 'path'
import { createAnyReqFiles } from '@server/helpers/express-utils'
import { CONFIG } from '@server/initializers/config'
import { MIMETYPES } from '@server/initializers/constants'
import { JobQueue } from '@server/lib/job-queue'
import { buildTaskFileFieldname, getTaskFileFromReq } from '@server/lib/video-studio'
import {
  HttpStatusCode,
  VideoState,
  VideoStudioCreateEdition,
  VideoStudioTask,
  VideoStudioTaskCut,
  VideoStudioTaskIntro,
  VideoStudioTaskOutro,
  VideoStudioTaskPayload,
  VideoStudioTaskWatermark
} from '@shared/models'
import { asyncMiddleware, authenticate, videoStudioAddEditionValidator } from '../../../middlewares'

const studioRouter = express.Router()

const tasksFiles = createAnyReqFiles(
  MIMETYPES.VIDEO.MIMETYPE_EXT,
  (req: express.Request, file: Express.Multer.File, cb: (err: Error, result?: boolean) => void) => {
    const body = req.body as VideoStudioCreateEdition

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

studioRouter.post('/:videoId/studio/edit',
  authenticate,
  tasksFiles,
  asyncMiddleware(videoStudioAddEditionValidator),
  asyncMiddleware(createEditionTasks)
)

// ---------------------------------------------------------------------------

export {
  studioRouter
}

// ---------------------------------------------------------------------------

async function createEditionTasks (req: express.Request, res: express.Response) {
  const files = req.files as Express.Multer.File[]
  const body = req.body as VideoStudioCreateEdition
  const video = res.locals.videoAll

  video.state = VideoState.TO_EDIT
  await video.save()

  const payload = {
    videoUUID: video.uuid,
    tasks: await Bluebird.mapSeries(body.tasks, (t, i) => buildTaskPayload(t, i, files))
  }

  JobQueue.Instance.createJobAsync({ type: 'video-studio-edition', payload })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

const taskPayloadBuilders: {
  [id in VideoStudioTask['name']]: (
    task: VideoStudioTask,
    indice?: number,
    files?: Express.Multer.File[]
  ) => Promise<VideoStudioTaskPayload>
} = {
  'add-intro': buildIntroOutroTask,
  'add-outro': buildIntroOutroTask,
  'cut': buildCutTask,
  'add-watermark': buildWatermarkTask
}

function buildTaskPayload (task: VideoStudioTask, indice: number, files: Express.Multer.File[]): Promise<VideoStudioTaskPayload> {
  return taskPayloadBuilders[task.name](task, indice, files)
}

async function buildIntroOutroTask (task: VideoStudioTaskIntro | VideoStudioTaskOutro, indice: number, files: Express.Multer.File[]) {
  const destination = await moveStudioFileToPersistentTMP(getTaskFileFromReq(files, indice).path)

  return {
    name: task.name,
    options: {
      file: destination
    }
  }
}

function buildCutTask (task: VideoStudioTaskCut) {
  return Promise.resolve({
    name: task.name,
    options: {
      start: task.options.start,
      end: task.options.end
    }
  })
}

async function buildWatermarkTask (task: VideoStudioTaskWatermark, indice: number, files: Express.Multer.File[]) {
  const destination = await moveStudioFileToPersistentTMP(getTaskFileFromReq(files, indice).path)

  return {
    name: task.name,
    options: {
      file: destination
    }
  }
}

async function moveStudioFileToPersistentTMP (file: string) {
  const destination = join(CONFIG.STORAGE.TMP_PERSISTENT_DIR, basename(file))

  await move(file, destination)

  return destination
}
