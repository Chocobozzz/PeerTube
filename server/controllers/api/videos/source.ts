import express from 'express'
import { move } from 'fs-extra'
import { sequelizeTypescript } from '@server/initializers/database'
import { CreateJobArgument, CreateJobOptions, JobQueue } from '@server/lib/job-queue'
import { Hooks } from '@server/lib/plugins/hooks'
import { regenerateMiniaturesIfNeeded } from '@server/lib/thumbnail'
import { uploadx } from '@server/lib/uploadx'
import { buildMoveToObjectStorageJob } from '@server/lib/video'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist'
import { buildNewFile } from '@server/lib/video-file'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { buildNextVideoState } from '@server/lib/video-state'
import { openapiOperationDoc } from '@server/middlewares/doc'
import { VideoModel } from '@server/models/video/video'
import { VideoSourceModel } from '@server/models/video/video-source'
import { MStreamingPlaylistFiles, MVideo, MVideoFile, MVideoFullLight } from '@server/types/models'
import { VideoState } from '@shared/models'
import { logger, loggerTagsFactory } from '../../../helpers/logger'
import {
  asyncMiddleware,
  authenticate,
  replaceVideoSourceResumableInitValidator,
  replaceVideoSourceResumableValidator,
  videoSourceGetLatestValidator
} from '../../../middlewares'

const lTags = loggerTagsFactory('api', 'video')

const videoSourceRouter = express.Router()

videoSourceRouter.get('/:id/source',
  openapiOperationDoc({ operationId: 'getVideoSource' }),
  authenticate,
  asyncMiddleware(videoSourceGetLatestValidator),
  getVideoLatestSource
)

videoSourceRouter.post('/:id/source/replace-resumable',
  authenticate,
  asyncMiddleware(replaceVideoSourceResumableInitValidator),
  (req, res) => uploadx.upload(req, res) // Prevent next() call, explicitely tell to uploadx it's the end
)

videoSourceRouter.delete('/:id/source/replace-resumable',
  authenticate,
  (req, res) => uploadx.upload(req, res) // Prevent next() call, explicitely tell to uploadx it's the end
)

videoSourceRouter.put('/:id/source/replace-resumable',
  authenticate,
  uploadx.upload, // uploadx doesn't next() before the file upload completes
  asyncMiddleware(replaceVideoSourceResumableValidator),
  asyncMiddleware(replaceVideoSourceResumable)
)

// ---------------------------------------------------------------------------

export {
  videoSourceRouter
}

// ---------------------------------------------------------------------------

function getVideoLatestSource (req: express.Request, res: express.Response) {
  return res.json(res.locals.videoSource.toFormattedJSON())
}

async function replaceVideoSourceResumable (req: express.Request, res: express.Response) {
  const videoPhysicalFile = res.locals.updateVideoFileResumable
  const user = res.locals.oauth.token.User

  const videoFile = await buildNewFile({ path: videoPhysicalFile.path, mode: 'web-video' })
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

    const source = await VideoSourceModel.create({
      filename: originalFilename,
      videoId: video.id,
      createdAt: inputFileUpdatedAt
    })

    await regenerateMiniaturesIfNeeded(video)
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

    {
      type: 'generate-video-storyboard' as 'generate-video-storyboard',
      payload: {
        videoUUID: video.uuid,
        // No need to federate, we process these jobs sequentially
        federate: false
      }
    },

    {
      type: 'federate-video' as 'federate-video',
      payload: {
        videoUUID: video.uuid,
        isNewVideo: false
      }
    }
  ]

  if (video.state === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
    jobs.push(await buildMoveToObjectStorageJob({ video, isNewVideo: false, previousVideoState: undefined }))
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
