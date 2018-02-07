import * as kue from 'kue'
import { JobType, JobState } from '../../../shared/models'
import { logger } from '../../helpers/logger'
import { CONFIG, JOB_ATTEMPTS, JOB_COMPLETED_LIFETIME, JOB_CONCURRENCY } from '../../initializers'
import { ActivitypubHttpBroadcastPayload, processActivityPubHttpBroadcast } from './handlers/activitypub-http-broadcast'
import { ActivitypubHttpFetcherPayload, processActivityPubHttpFetcher } from './handlers/activitypub-http-fetcher'
import { ActivitypubHttpUnicastPayload, processActivityPubHttpUnicast } from './handlers/activitypub-http-unicast'
import { EmailPayload, processEmail } from './handlers/email'
import { processVideoFile, VideoFilePayload } from './handlers/video-file'

type CreateJobArgument =
  { type: 'activitypub-http-broadcast', payload: ActivitypubHttpBroadcastPayload } |
  { type: 'activitypub-http-unicast', payload: ActivitypubHttpUnicastPayload } |
  { type: 'activitypub-http-fetcher', payload: ActivitypubHttpFetcherPayload } |
  { type: 'video-file', payload: VideoFilePayload } |
  { type: 'email', payload: EmailPayload }

const handlers: { [ id in JobType ]: (job: kue.Job) => Promise<any>} = {
  'activitypub-http-broadcast': processActivityPubHttpBroadcast,
  'activitypub-http-unicast': processActivityPubHttpUnicast,
  'activitypub-http-fetcher': processActivityPubHttpFetcher,
  'video-file': processVideoFile,
  'email': processEmail
}

class JobQueue {

  private static instance: JobQueue

  private jobQueue: kue.Queue
  private initialized = false

  private constructor () {}

  init () {
    // Already initialized
    if (this.initialized === true) return
    this.initialized = true

    this.jobQueue = kue.createQueue({
      prefix: 'q-' + CONFIG.WEBSERVER.HOST,
      redis: {
        host: CONFIG.REDIS.HOSTNAME,
        port: CONFIG.REDIS.PORT,
        auth: CONFIG.REDIS.AUTH
      }
    })

    this.jobQueue.setMaxListeners(15)

    this.jobQueue.on('error', err => {
      logger.error('Error in job queue.', err)
      process.exit(-1)
    })
    this.jobQueue.watchStuckJobs(5000)

    for (const handlerName of Object.keys(handlers)) {
      this.jobQueue.process(handlerName, JOB_CONCURRENCY[handlerName], async (job, done) => {
        try {
          const res = await handlers[ handlerName ](job)
          return done(null, res)
        } catch (err) {
          return done(err)
        }
      })
    }
  }

  createJob (obj: CreateJobArgument, priority = 'normal') {
    return new Promise((res, rej) => {
      this.jobQueue
        .create(obj.type, obj.payload)
        .priority(priority)
        .attempts(JOB_ATTEMPTS[obj.type])
        .backoff({ delay: 60 * 1000, type: 'exponential' })
        .save(err => {
          if (err) return rej(err)

          return res()
        })
    })
  }

  listForApi (state: JobState, start: number, count: number, sort: string) {
    return new Promise<kue.Job[]>((res, rej) => {
      kue.Job.rangeByState(state, start, start + count - 1, sort, (err, jobs) => {
        if (err) return rej(err)

        return res(jobs)
      })
    })
  }

  count (state: JobState) {
    return new Promise<number>((res, rej) => {
      this.jobQueue[state + 'Count']((err, total) => {
        if (err) return rej(err)

        return res(total)
      })
    })
  }

  removeOldJobs () {
    const now = new Date().getTime()
    kue.Job.rangeByState('complete', 0, -1, 'asc', (err, jobs) => {
      if (err) {
        logger.error('Cannot get jobs when removing old jobs.', err)
        return
      }

      for (const job of jobs) {
        if (now - job.created_at > JOB_COMPLETED_LIFETIME) {
          job.remove()
        }
      }
    })
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  JobQueue
}
