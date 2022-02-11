import express from 'express'
import { body, param } from 'express-validator'
import { isIdOrUUIDValid } from '@server/helpers/custom-validators/misc'
import {
  isEditorCutTaskValid,
  isEditorTaskAddIntroOutroValid,
  isEditorTaskAddWatermarkValid,
  isValidEditorTasksArray
} from '@server/helpers/custom-validators/video-editor'
import { cleanUpReqFiles } from '@server/helpers/express-utils'
import { CONFIG } from '@server/initializers/config'
import { approximateIntroOutroAdditionalSize, getTaskFile } from '@server/lib/video-editor'
import { isAudioFile } from '@shared/extra-utils'
import { HttpStatusCode, UserRight, VideoEditorCreateEdition, VideoEditorTask, VideoState } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { areValidationErrors, checkUserCanManageVideo, checkUserQuota, doesVideoExist } from '../shared'

const videosEditorAddEditionValidator = [
  param('videoId').custom(isIdOrUUIDValid).withMessage('Should have a valid video id/uuid'),

  body('tasks').custom(isValidEditorTasksArray).withMessage('Should have a valid array of tasks'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosEditorAddEditionValidator parameters.', { parameters: req.params, body: req.body, files: req.files })

    if (CONFIG.VIDEO_EDITOR.ENABLED !== true) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Video editor is disabled on this instance'
      })

      return cleanUpReqFiles(req)
    }

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)

    const body: VideoEditorCreateEdition = req.body
    const files = req.files as Express.Multer.File[]

    for (let i = 0; i < body.tasks.length; i++) {
      const task = body.tasks[i]

      if (!checkTask(req, task, i)) {
        res.fail({
          status: HttpStatusCode.BAD_REQUEST_400,
          message: `Task ${task.name} is invalid`
        })

        return cleanUpReqFiles(req)
      }

      if (task.name === 'add-intro' || task.name === 'add-outro') {
        const filePath = getTaskFile(files, i).path

        // Our concat filter needs a video stream
        if (await isAudioFile(filePath)) {
          res.fail({
            status: HttpStatusCode.BAD_REQUEST_400,
            message: `Task ${task.name} is invalid: file does not contain a video stream`
          })

          return cleanUpReqFiles(req)
        }
      }
    }

    if (!await doesVideoExist(req.params.videoId, res)) return cleanUpReqFiles(req)

    const video = res.locals.videoAll
    if (video.state === VideoState.TO_TRANSCODE || video.state === VideoState.TO_EDIT) {
      res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: 'Cannot edit video that is already waiting for transcoding/edition'
      })

      return cleanUpReqFiles(req)
    }

    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, video, UserRight.UPDATE_ANY_VIDEO, res)) return cleanUpReqFiles(req)

    // Try to make an approximation of bytes added by the intro/outro
    const additionalBytes = await approximateIntroOutroAdditionalSize(video, body.tasks, i => getTaskFile(files, i).path)
    if (await checkUserQuota(user, additionalBytes, res) === false) return cleanUpReqFiles(req)

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videosEditorAddEditionValidator
}

// ---------------------------------------------------------------------------

const taskCheckers: {
  [id in VideoEditorTask['name']]: (task: VideoEditorTask, indice?: number, files?: Express.Multer.File[]) => boolean
} = {
  'cut': isEditorCutTaskValid,
  'add-intro': isEditorTaskAddIntroOutroValid,
  'add-outro': isEditorTaskAddIntroOutroValid,
  'add-watermark': isEditorTaskAddWatermarkValid
}

function checkTask (req: express.Request, task: VideoEditorTask, indice?: number) {
  const checker = taskCheckers[task.name]
  if (!checker) return false

  return checker(task, indice, req.files as Express.Multer.File[])
}
