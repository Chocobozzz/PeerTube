import express from 'express'
import { body, param } from 'express-validator'
import { isIdOrUUIDValid } from '@server/helpers/custom-validators/misc.js'
import {
  isStudioCutTaskValid,
  isStudioTaskAddIntroOutroValid,
  isStudioTaskAddWatermarkValid,
  isValidStudioTasksArray
} from '@server/helpers/custom-validators/video-studio.js'
import { cleanUpReqFiles } from '@server/helpers/express-utils.js'
import { CONFIG } from '@server/initializers/config.js'
import { approximateIntroOutroAdditionalSize, getTaskFileFromReq } from '@server/lib/video-studio.js'
import { isAudioFile } from '@peertube/peertube-ffmpeg'
import { HttpStatusCode, UserRight, VideoStudioCreateEdition, VideoStudioTask } from '@peertube/peertube-models'
import { areValidationErrors, checkUserCanManageVideo, checkUserQuota, doesVideoExist } from '../shared/index.js'
import { checkVideoFileCanBeEdited } from './shared/index.js'

const videoStudioAddEditionValidator = [
  param('videoId')
    .custom(isIdOrUUIDValid).withMessage('Should have a valid video id/uuid/short uuid'),

  body('tasks')
    .custom(isValidStudioTasksArray).withMessage('Should have a valid array of tasks'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (CONFIG.VIDEO_STUDIO.ENABLED !== true) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Video studio is disabled on this instance'
      })

      return cleanUpReqFiles(req)
    }

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)
    if (!await doesVideoExist(req.params.videoId, res)) return cleanUpReqFiles(req)

    const body: VideoStudioCreateEdition = req.body
    const files = req.files as Express.Multer.File[]

    const video = res.locals.videoAll
    const videoIsAudio = video.hasAudio() && !video.hasVideo()

    for (let i = 0; i < body.tasks.length; i++) {
      const task = body.tasks[i]

      if (!checkTask(req, task, i)) {
        res.fail({
          status: HttpStatusCode.BAD_REQUEST_400,
          message: `Task ${task.name} is invalid`
        })

        return cleanUpReqFiles(req)
      }

      if (videoIsAudio) {
        if (task.name === 'add-intro' || task.name === 'add-outro' || task.name === 'add-watermark') {
          res.fail({
            status: HttpStatusCode.BAD_REQUEST_400,
            message: `Task ${task.name} is invalid: video does not contain a video stream`
          })

          return cleanUpReqFiles(req)
        }
      }

      if (task.name === 'add-intro' || task.name === 'add-outro') {
        const filePath = getTaskFileFromReq(files, i).path

        // Our concat filter needs a video stream
        if (await isAudioFile(filePath)) {
          res.fail({
            status: HttpStatusCode.BAD_REQUEST_400,
            message: `Task ${task.name} is invalid: input file does not contain a video stream`
          })

          return cleanUpReqFiles(req)
        }
      }
    }

    if (!checkVideoFileCanBeEdited(video, res)) return cleanUpReqFiles(req)

    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, video, UserRight.UPDATE_ANY_VIDEO, res)) return cleanUpReqFiles(req)

    // Try to make an approximation of bytes added by the intro/outro
    const additionalBytes = await approximateIntroOutroAdditionalSize(video, body.tasks, i => getTaskFileFromReq(files, i).path)
    if (await checkUserQuota(user, additionalBytes, res) === false) return cleanUpReqFiles(req)

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoStudioAddEditionValidator
}

// ---------------------------------------------------------------------------

const taskCheckers: {
  [id in VideoStudioTask['name']]: (task: VideoStudioTask, indice?: number, files?: Express.Multer.File[]) => boolean
} = {
  'cut': isStudioCutTaskValid,
  'add-intro': isStudioTaskAddIntroOutroValid,
  'add-outro': isStudioTaskAddIntroOutroValid,
  'add-watermark': isStudioTaskAddWatermarkValid
}

function checkTask (req: express.Request, task: VideoStudioTask, indice?: number) {
  const checker = taskCheckers[task.name]
  if (!checker) return false

  return checker(task, indice, req.files as Express.Multer.File[])
}
