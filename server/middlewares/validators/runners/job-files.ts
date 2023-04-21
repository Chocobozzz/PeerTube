import express from 'express'
import { HttpStatusCode } from '@shared/models'
import { areValidationErrors, doesVideoExist, isValidVideoIdParam } from '../shared'

const tags = [ 'runner' ]

export const runnerJobGetVideoTranscodingFileValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoExist(req.params.videoId, res, 'all')) return

    const runnerJob = res.locals.runnerJob

    if (runnerJob.privatePayload.videoUUID !== res.locals.videoAll.uuid) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Job is not associated to this video',
        tags: [ ...tags, res.locals.videoAll.uuid ]
      })
    }

    return next()
  }
]
