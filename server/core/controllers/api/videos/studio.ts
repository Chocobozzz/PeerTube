import {
  HttpStatusCode,
  VideoChannelActivityAction,
  VideoState,
  VideoStudioCreateEdition,
  VideoStudioEditionPayload,
  VideoStudioTask,
  VideoStudioTaskCut,
  VideoStudioTaskIntro,
  VideoStudioTaskOutro,
  VideoStudioTaskPayload,
  VideoStudioTaskRemoveSegments,
  VideoStudioTaskWatermark
} from '@peertube/peertube-models'
import { createAnyReqFiles } from '@server/helpers/express-utils.js'
import { CONFIG } from '@server/initializers/config.js'
import { MIMETYPES, VIDEO_FILTERS } from '@server/initializers/constants.js'
import {
  buildTaskFileFieldname,
  createVideoStudioJob,
  getTaskFileFromReq,
  handleStudioTaskFile,
  safeCleanupStudioTMPFiles
} from '@server/lib/video-studio.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import express from 'express'
import { asyncMiddleware, authenticate, videoStudioAddEditionValidator } from '../../../middlewares/index.js'

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

studioRouter.post(
  '/:videoId/studio/edit',
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
  const video = res.locals.videoFull

  const taskFilesStaged = CONFIG.OBJECT_STORAGE.ENABLED

  // Before changing the video state: storing task files in object storage can fail, and no job would reset the state
  const payload: VideoStudioEditionPayload = {
    videoUUID: video.uuid,
    tasks: await buildTaskPayloads({ tasks: body.tasks, files, taskFilesStaged }),
    taskFilesStaged
  }

  video.state = VideoState.TO_EDIT
  await video.save()

  const user = res.locals.oauth.token.User

  await createVideoStudioJob({
    user,
    payload,
    video
  })

  await VideoChannelActivityModel.addVideoActivity({
    action: VideoChannelActivityAction.CREATE_STUDIO_TASKS,
    user,
    channel: video.VideoChannel,
    video,
    transaction: null
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

type TaskPayloadBuilderOptions<T extends VideoStudioTask = VideoStudioTask> = {
  task: T
  indice: number
  files: Express.Multer.File[]
  taskFilesStaged: boolean
}

const taskPayloadBuilders: {
  [id in VideoStudioTask['name']]: (options: TaskPayloadBuilderOptions) => Promise<VideoStudioTaskPayload>
} = {
  'add-intro': buildIntroOutroTask,
  'add-outro': buildIntroOutroTask,
  'cut': buildCutTask,
  'add-watermark': buildWatermarkTask,
  'remove-segments': buildRemoveSegmentsTask
}

async function buildTaskPayloads (options: {
  tasks: VideoStudioTask[]
  files: Express.Multer.File[]
  taskFilesStaged: boolean
}) {
  const { tasks, files, taskFilesStaged } = options
  const payloads: VideoStudioTaskPayload[] = []

  try {
    for (let indice = 0; indice < tasks.length; indice++) {
      payloads.push(await buildTaskPayload({ task: tasks[indice], indice, files, taskFilesStaged }))
    }

    return payloads
  } catch (err) {
    await safeCleanupStudioTMPFiles({ tasks: payloads, taskFilesStaged })

    throw err
  }
}

function buildTaskPayload (options: TaskPayloadBuilderOptions): Promise<VideoStudioTaskPayload> {
  return taskPayloadBuilders[options.task.name](options)
}

async function buildIntroOutroTask (options: TaskPayloadBuilderOptions<VideoStudioTaskIntro | VideoStudioTaskOutro>) {
  const { task } = options

  return {
    name: task.name,
    options: {
      file: await handleTaskFile(options)
    }
  }
}

function buildCutTask ({ task }: TaskPayloadBuilderOptions<VideoStudioTaskCut>) {
  return Promise.resolve({
    name: task.name,
    options: {
      start: task.options.start,
      end: task.options.end
    }
  })
}

async function buildWatermarkTask (options: TaskPayloadBuilderOptions<VideoStudioTaskWatermark>) {
  const { task } = options

  return {
    name: task.name,
    options: {
      file: await handleTaskFile(options),
      watermarkSizeRatio: VIDEO_FILTERS.WATERMARK.SIZE_RATIO,
      horizontalMarginRatio: VIDEO_FILTERS.WATERMARK.HORIZONTAL_MARGIN_RATIO,
      verticalMarginRatio: VIDEO_FILTERS.WATERMARK.VERTICAL_MARGIN_RATIO
    }
  }
}

function buildRemoveSegmentsTask ({ task }: TaskPayloadBuilderOptions<VideoStudioTaskRemoveSegments>) {
  return Promise.resolve({
    name: task.name,
    options: {
      segments: task.options.segments
    }
  })
}

function handleTaskFile (options: TaskPayloadBuilderOptions) {
  return handleStudioTaskFile({ file: getTaskFileFromReq(options.files, options.indice), staged: options.taskFilesStaged })
}
