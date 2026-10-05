import express from 'express'
import { uuidToShort } from '@peertube/peertube-node-utils'
import {
  HttpStatusCode,
  VideoChannelActivityAction,
  VideoState,
  VideoStudioCreateEdition,
  VideoStudioCreateEditionNewVideo,
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
  createNewVideoForStudio,
  createVideoStudioJob,
  getTaskFileFromReq,
  handleStudioTaskFile,
  onVideoStudioFailed,
  safeCleanupStudioTMPFiles
} from '@server/lib/video-studio.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { MVideoFull } from '@server/types/models/index.js'
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
  const sourceVideo = res.locals.videoFull
  const user = res.locals.oauth.token.User

  const taskFilesStaged = CONFIG.OBJECT_STORAGE.ENABLED

  // Before changing the video state: storing task files in object storage can fail, and no job would reset the state
  const tasks = await buildTaskPayloads({ tasks: body.tasks, files, taskFilesStaged })

  let newVideo: MVideoFull | undefined
  let video = sourceVideo

  try {
    // The source video is left untouched: the result is saved in a new video that the user can edit while it is processing
    if (body.saveAsNewVideo === true) {
      newVideo = await createNewVideoForStudio({ sourceVideo, user, name: sourceVideo.name })
      video = newVideo
    } else {
      video.state = VideoState.TO_EDIT
      await video.save()
    }

    await createVideoStudioJob({
      user,
      payload: {
        videoUUID: video.uuid,
        sourceVideoUUID: newVideo ? sourceVideo.uuid : undefined,
        tasks,
        taskFilesStaged
      },
      video,
      sourceVideo: newVideo ? sourceVideo : undefined
    })
  } catch (err) {
    await safeCleanupStudioTMPFiles({ tasks, taskFilesStaged })

    // Don't leave a video stuck in edition state (or an empty new video) because its job was never created
    await onVideoStudioFailed({ videoUUID: video.uuid, isNewVideo: !!newVideo })

    throw err
  }

  await VideoChannelActivityModel.addVideoActivity({
    action: VideoChannelActivityAction.CREATE_STUDIO_TASKS,
    user,
    channel: video.VideoChannel,
    video,
    transaction: null
  })

  if (newVideo) {
    return res.json({
      video: {
        id: newVideo.id,
        uuid: newVideo.uuid,
        shortUUID: uuidToShort(newVideo.uuid)
      }
    } satisfies VideoStudioCreateEditionNewVideo)
  }

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
