import * as kue from 'kue'
import { JobState, JobType } from '../../../shared/models'
import { logger } from '../../helpers/logger'
import { CONFIG, JOB_ATTEMPTS, JOB_COMPLETED_LIFETIME, JOB_CONCURRENCY } from '../../initializers'
import { Redis } from '../redis'
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
  private jobRedisPrefix: string

  private constructor () {}

  async init () {
    // Already initialized
    if (this.initialized === true) return
    this.initialized = true

    this.jobRedisPrefix = 'q-' + CONFIG.WEBSERVER.HOST

    this.jobQueue = kue.createQueue({
      prefix: this.jobRedisPrefix,
      redis: {
        host: CONFIG.REDIS.HOSTNAME,
        port: CONFIG.REDIS.PORT,
        auth: CONFIG.REDIS.AUTH
      }
    })

    this.jobQueue.setMaxListeners(15)

    this.jobQueue.on('error', err => {
      logger.error('Error in job queue.', { err })
      process.exit(-1)
    })
    this.jobQueue.watchStuckJobs(5000)

    await this.reactiveStuckJobs()

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

  async listForApi (state: JobState, start: number, count: number, sort: 'ASC' | 'DESC'): Promise<kue.Job[]> {
    const jobStrings = await Redis.Instance.listJobs(this.jobRedisPrefix, state, 'alpha', sort, start, count)

    const jobPromises = jobStrings
      .map(s => s.split('|'))
      .map(([ , jobId ]) => this.getJob(parseInt(jobId, 10)))

    return Promise.all(jobPromises)
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
        logger.error('Cannot get jobs when removing old jobs.', { err })
        return
      }

      for (const job of jobs) {
        if (now - job.created_at > JOB_COMPLETED_LIFETIME) {
          job.remove()
        }
      }
    })
  }

  private reactiveStuckJobs () {
    const promises: Promise<any>[] = []

    this.jobQueue.active((err, ids) => {
      if (err) throw err

      for (const id of ids) {
        kue.Job.get(id, (err, job) => {
          if (err) throw err

          const p = new Promise((res, rej) => {
            job.inactive(err => {
              if (err) return rej(err)
              return res()
            })
          })

          promises.push(p)
        })
      }
    })

    return Promise.all(promises)
  }

  private getJob (id: number) {
    return new Promise<kue.Job>((res, rej) => {
      kue.Job.get(id, (err, job) => {
        if (err) return rej(err)

        return res(job)
      })
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
