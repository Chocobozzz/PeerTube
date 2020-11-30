import { Response } from 'express'
import { JobState } from '../../../shared/models'
import { JobQueue } from '@server/lib/job-queue'

async function doesJobExist (id: number | string, res: Response, running = true) {
  const job = await JobQueue.Instance.loadById(id)

  if (job === null) {
    res.status(404)
       .json({ error: 'Job not found' })
       .end()

    return false
  }

  const jobState = await job.getState() as JobState
  if (jobState !== "active") {
    res.status(410)
       .json({ error: 'Job is not running anymore' })
       .end()
  }

  res.locals.job = job

  return true
}

export {
  doesJobExist
}
