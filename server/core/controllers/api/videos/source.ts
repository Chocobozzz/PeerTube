import { buildAspectRatio } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserRight, VideoState } from '@peertube/peertube-models'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { CreateJobArgument, CreateJobOptions, JobQueue } from '@server/lib/job-queue/index.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { regenerateMiniaturesIfNeeded } from '@server/lib/thumbnail.js'
import { setupUploadResumableRoutes } from '@server/lib/uploadx.js'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist.js'
import { buildNewFile, createVideoSource } from '@server/lib/video-file.js'
import { buildMoveJob, buildStoryboardJobIfNeeded } from '@server/lib/video-jobs.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { buildNextVideoState } from '@server/lib/video-state.js'
import { openapiOperationDoc } from '@server/middlewares/doc.js'
import { VideoModel } from '@server/models/video/video.js'
import { MStreamingPlaylistFiles, MVideo, MVideoFile, MVideoFullLight } from '@server/types/models/index.js'
import express from 'express'
import { move } from 'fs-extra/esm'
import { logger, loggerTagsFactory } from '../../../helpers/logger.js'
import {
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  replaceVideoSourceResumableInitValidator,
  replaceVideoSourceResumableValidator,
  videoSourceGetLatestValidator
} from '../../../middlewares/index.js'

const lTags = loggerTagsFactory('api', 'video')

const videoSourceRouter = express.Router()

videoSourceRouter.get('/:id/source',
  openapiOperationDoc({ operationId: 'getVideoSource' }),
  authenticate,
  asyncMiddleware(videoSourceGetLatestValidator),
  getVideoLatestSource
)

videoSourceRouter.delete('/:id/source/file',
  openapiOperationDoc({ operationId: 'deleteVideoSourceFile' }),
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_FILES),
  asyncMiddleware(videoSourceGetLatestValidator),
  asyncMiddleware(deleteVideoLatestSourceFile)
)

setupUploadResumableRoutes({
  routePath: '/:id/source/replace-resumable',
  router: videoSourceRouter,

  uploadInitAfterMiddlewares: [ asyncMiddleware(replaceVideoSourceResumableInitValidator) ],
  uploadedMiddlewares: [ asyncMiddleware(replaceVideoSourceResumableValidator) ],
  uploadedController: asyncMiddleware(replaceVideoSourceResumable)
})

// ---------------------------------------------------------------------------

export {
  videoSourceRouter
}

// ---------------------------------------------------------------------------

async function deleteVideoLatestSourceFile (req: express.Request, res: express.Response) {
  const videoSource = res.locals.videoSource
  const video = res.locals.videoAll

  await video.removeOriginalFile(videoSource)

  videoSource.keptOriginalFilename = null
  videoSource.fps = null
  videoSource.resolution = null
  videoSource.width = null
  videoSource.height = null
  videoSource.metadata = null
  videoSource.size = null
  await videoSource.save()

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

function getVideoLatestSource (req: express.Request, res: express.Response) {
  return res.json(res.locals.videoSource.toFormattedJSON())
}

async function replaceVideoSourceResumable (req: express.Request, res: express.Response) {
  const videoPhysicalFile = res.locals.updateVideoFileResumable
  const user = res.locals.oauth.token.User

  const videoFile = await buildNewFile({ path: videoPhysicalFile.path, mode: 'web-video', ffprobe: res.locals.ffprobe })
  const originalFilename = videoPhysicalFile.originalname

  const videoFileMutexReleaser = await VideoPathManager.Instance.lockFiles(res.locals.videoAll.uuid)

  try {
    const destination = VideoPathManager.Instance.getFSVideoFileOutputPath(res.locals.videoAll, videoFile)
    await move(videoPhysicalFile.path, destination)

    let oldWebVideoFiles: MVideoFile[] = []
    let oldStreamingPlaylists: MStreamingPlaylistFiles[] = []

    const inputFileUpdatedAt = new Date()

    const video = await sequelizeTypescript.transaction(async transaction => {
      const video = await VideoModel.loadFull(res.locals.videoAll.id, transaction)

      oldWebVideoFiles = video.VideoFiles
      oldStreamingPlaylists = video.VideoStreamingPlaylists

      for (const file of video.VideoFiles) {
        await file.destroy({ transaction })
      }
      for (const playlist of oldStreamingPlaylists) {
        await playlist.destroy({ transaction })
      }

      videoFile.videoId = video.id
      await videoFile.save({ transaction })

      video.VideoFiles = [ videoFile ]
      video.VideoStreamingPlaylists = []

      video.state = buildNextVideoState()
      video.duration = videoPhysicalFile.duration
      video.inputFileUpdatedAt = inputFileUpdatedAt
      video.aspectRatio = buildAspectRatio({ width: videoFile.width, height: videoFile.height })
      await video.save({ transaction })

      await autoBlacklistVideoIfNeeded({
        video,
        user,
        isRemote: false,
        isNew: false,
        isNewFile: true,
        transaction
      })

      return video
    })

    await removeOldFiles({ video, files: oldWebVideoFiles, playlists: oldStreamingPlaylists })

    const source = await createVideoSource({
      inputFilename: originalFilename,
      inputProbe: res.locals.ffprobe,
      inputPath: destination,
      video,
      createdAt: inputFileUpdatedAt
    })

    await regenerateMiniaturesIfNeeded(video, res.locals.ffprobe)
    await video.VideoChannel.setAsUpdated()
    await addVideoJobsAfterUpload(video, video.getMaxQualityFile())

    logger.info('Replaced video file of video %s with uuid %s.', video.name, video.uuid, lTags(video.uuid))

    Hooks.runAction('action:api.video.file-updated', { video, req, res })

    return res.json(source.toFormattedJSON())
  } finally {
    videoFileMutexReleaser()
  }
}

async function addVideoJobsAfterUpload (video: MVideoFullLight, videoFile: MVideoFile) {
  const jobs: (CreateJobArgument & CreateJobOptions)[] = [
    {
      type: 'manage-video-torrent' as 'manage-video-torrent',
      payload: {
        videoId: video.id,
        videoFileId: videoFile.id,
        action: 'create'
      }
    },

    buildStoryboardJobIfNeeded({ video, federate: false }),

    {
      type: 'federate-video' as 'federate-video',
      payload: {
        videoUUID: video.uuid,
        isNewVideoForFederation: false
      }
    }
  ]

  if (video.state === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
    jobs.push(await buildMoveJob({ video, isNewVideo: false, previousVideoState: undefined, type: 'move-to-object-storage' }))
  }

  if (video.state === VideoState.TO_TRANSCODE) {
    jobs.push({
      type: 'transcoding-job-builder' as 'transcoding-job-builder',
      payload: {
        videoUUID: video.uuid,
        optimizeJob: {
          isNewVideo: false
        }
      }
    })
  }

  return JobQueue.Instance.createSequentialJobFlow(...jobs)
}

async function removeOldFiles (options: {
  video: MVideo
  files: MVideoFile[]
  playlists: MStreamingPlaylistFiles[]
}) {
  const { video, files, playlists } = options

  for (const file of files) {
    await video.removeWebVideoFile(file)
  }

  for (const playlist of playlists) {
    await video.removeStreamingPlaylistFiles(playlist)
  }
}
