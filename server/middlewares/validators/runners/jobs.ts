import express from 'express'
import { body, param } from 'express-validator'
import { isUUIDValid } from '@server/helpers/custom-validators/misc'
import {
  isRunnerJobAbortReasonValid,
  isRunnerJobErrorMessageValid,
  isRunnerJobProgressValid,
  isRunnerJobSuccessPayloadValid,
  isRunnerJobTokenValid,
  isRunnerJobUpdatePayloadValid
} from '@server/helpers/custom-validators/runners/jobs'
import { isRunnerTokenValid } from '@server/helpers/custom-validators/runners/runners'
import { cleanUpReqFiles } from '@server/helpers/express-utils'
import { RunnerJobModel } from '@server/models/runner/runner-job'
import { HttpStatusCode, RunnerJobState, RunnerJobSuccessBody, RunnerJobUpdateBody, ServerErrorCode } from '@shared/models'
import { areValidationErrors } from '../shared'

const tags = [ 'runner' ]

export const acceptRunnerJobValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.locals.runnerJob.state !== RunnerJobState.PENDING) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'This runner job is not in pending state',
        tags
      })
    }

    return next()
  }
]

export const abortRunnerJobValidator = [
  body('reason').custom(isRunnerJobAbortReasonValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res, { tags })) return

    return next()
  }
]

export const updateRunnerJobValidator = [
  body('progress').optional().custom(isRunnerJobProgressValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res, { tags })) return cleanUpReqFiles(req)

    const body = req.body as RunnerJobUpdateBody

    if (isRunnerJobUpdatePayloadValid(body.payload, res.locals.runnerJob.type, req.files) !== true) {
      cleanUpReqFiles(req)

      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Payload is invalid',
        tags
      })
    }

    return next()
  }
]

export const errorRunnerJobValidator = [
  body('message').custom(isRunnerJobErrorMessageValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res, { tags })) return

    return next()
  }
]

export const successRunnerJobValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body = req.body as RunnerJobSuccessBody

    if (isRunnerJobSuccessPayloadValid(body.payload, res.locals.runnerJob.type, req.files) !== true) {
      cleanUpReqFiles(req)

      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Payload is invalid',
        tags
      })
    }

    return next()
  }
]

export const cancelRunnerJobValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const runnerJob = res.locals.runnerJob

    const allowedStates = new Set<RunnerJobState>([
      RunnerJobState.PENDING,
      RunnerJobState.PROCESSING,
      RunnerJobState.WAITING_FOR_PARENT_JOB
    ])

    if (allowedStates.has(runnerJob.state) !== true) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Cannot cancel this job that is not in "pending", "processing" or "waiting for parent job" state',
        tags
      })
    }

    return next()
  }
]

export const runnerJobGetValidator = [
  param('jobUUID').custom(isUUIDValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res, { tags })) return

    const runnerJob = await RunnerJobModel.loadWithRunner(req.params.jobUUID)

    if (!runnerJob) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Unknown runner job',
        tags
      })
    }

    res.locals.runnerJob = runnerJob

    return next()
  }
]

export const jobOfRunnerGetValidator = [
  param('jobUUID').custom(isUUIDValid),

  body('runnerToken').custom(isRunnerTokenValid),
  body('jobToken').custom(isRunnerJobTokenValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res, { tags })) return cleanUpReqFiles(req)

    const runnerJob = await RunnerJobModel.loadByRunnerAndJobTokensWithRunner({
      uuid: req.params.jobUUID,
      runnerToken: req.body.runnerToken,
      jobToken: req.body.jobToken
    })

    if (!runnerJob) {
      cleanUpReqFiles(req)

      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Unknown runner job',
        tags
      })
    }

    if (runnerJob.state !== RunnerJobState.PROCESSING) {
      cleanUpReqFiles(req)

      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        type: ServerErrorCode.RUNNER_JOB_NOT_IN_PROCESSING_STATE,
        message: 'Job is not in "processing" state',
        tags
      })
    }

    res.locals.runnerJob = runnerJob

    return next()
  }
]
