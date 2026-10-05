import Bluebird from 'bluebird'
import express from 'express'
import { move } from 'fs-extra/esm'
import { basename } from 'path'
import { uuidToShort } from '@peertube/peertube-node-utils'
import { createAnyReqFiles } from '@server/helpers/express-utils.js'
import { MIMETYPES, VIDEO_FILTERS } from '@server/initializers/constants.js'
import {
  buildTaskFileFieldname,
  createNewVideoForStudio,
  createVideoStudioJob,
  getStudioTaskFilePath,
  getTaskFileFromReq,
  onVideoStudioFailed,
  safeCleanupStudioTMPFiles
} from '@server/lib/video-studio.js'
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
import { asyncMiddleware, authenticate, videoStudioAddEditionValidator } from '../../../middlewares/index.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'

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

  const tasks = await Bluebird.mapSeries(body.tasks, (t, i) => buildTaskPayload(t, i, files))

  // The source video is left untouched: the result is saved in a new video that the user can edit while it is processing
  const newVideo = body.saveAsNewVideo === true
    ? await createNewVideoForStudio({ sourceVideo, user, name: sourceVideo.name })
    : undefined

  const video = newVideo ?? sourceVideo

  try {
    if (!newVideo) {
      video.state = VideoState.TO_EDIT
      await video.save()
    }

    await createVideoStudioJob({
      user,
      payload: {
        videoUUID: video.uuid,
        sourceVideoUUID: newVideo ? sourceVideo.uuid : undefined,
        tasks
      },
      video,
      sourceVideo: newVideo ? sourceVideo : undefined
    })
  } catch (err) {
    await safeCleanupStudioTMPFiles(tasks)

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
  'add-watermark': buildWatermarkTask,
  'remove-segments': buildRemoveSegmentsTask
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
      file: destination,
      watermarkSizeRatio: VIDEO_FILTERS.WATERMARK.SIZE_RATIO,
      horizontalMarginRatio: VIDEO_FILTERS.WATERMARK.HORIZONTAL_MARGIN_RATIO,
      verticalMarginRatio: VIDEO_FILTERS.WATERMARK.VERTICAL_MARGIN_RATIO
    }
  }
}

function buildRemoveSegmentsTask (task: VideoStudioTaskRemoveSegments) {
  return Promise.resolve({
    name: task.name,
    options: {
      segments: task.options.segments
    }
  })
}

async function moveStudioFileToPersistentTMP (file: string) {
  const destination = getStudioTaskFilePath(basename(file))

  await move(file, destination)

  return destination
}
