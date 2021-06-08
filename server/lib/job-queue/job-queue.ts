import * as Bull from 'bull'
import { jobStates } from '@server/helpers/custom-validators/jobs'
import { CONFIG } from '@server/initializers/config'
import { processVideoRedundancy } from '@server/lib/job-queue/handlers/video-redundancy'
import {
  ActivitypubFollowPayload,
  ActivitypubHttpBroadcastPayload,
  ActivitypubHttpFetcherPayload,
  ActivitypubHttpUnicastPayload,
  ActorKeysPayload,
  DeleteResumableUploadMetaFilePayload,
  EmailPayload,
  JobState,
  JobType,
  RefreshPayload,
  VideoFileImportPayload,
  VideoImportPayload,
  VideoLiveEndingPayload,
  VideoRedundancyPayload,
  VideoTranscodingPayload
} from '../../../shared/models'
import { logger } from '../../helpers/logger'
import { JOB_ATTEMPTS, JOB_COMPLETED_LIFETIME, JOB_CONCURRENCY, JOB_TTL, REPEAT_JOBS, WEBSERVER } from '../../initializers/constants'
import { Redis } from '../redis'
import { processActivityPubCleaner } from './handlers/activitypub-cleaner'
import { processActivityPubFollow } from './handlers/activitypub-follow'
import { processActivityPubHttpBroadcast } from './handlers/activitypub-http-broadcast'
import { processActivityPubHttpFetcher } from './handlers/activitypub-http-fetcher'
import { processActivityPubHttpUnicast } from './handlers/activitypub-http-unicast'
import { refreshAPObject } from './handlers/activitypub-refresher'
import { processActorKeys } from './handlers/actor-keys'
import { processEmail } from './handlers/email'
import { processVideoFileImport } from './handlers/video-file-import'
import { processVideoImport } from './handlers/video-import'
import { processVideoLiveEnding } from './handlers/video-live-ending'
import { processVideoTranscoding } from './handlers/video-transcoding'
import { processVideosViews } from './handlers/video-views'
import { processDeleteResumableUploadMetaFile } from './handlers/delete-resumable-upload-meta-file'

type CreateJobArgument =
  { type: 'activitypub-http-broadcast', payload: ActivitypubHttpBroadcastPayload } |
  { type: 'activitypub-http-unicast', payload: ActivitypubHttpUnicastPayload } |
  { type: 'activitypub-http-fetcher', payload: ActivitypubHttpFetcherPayload } |
  { type: 'activitypub-http-cleaner', payload: {} } |
  { type: 'activitypub-follow', payload: ActivitypubFollowPayload } |
  { type: 'video-file-import', payload: VideoFileImportPayload } |
  { type: 'video-transcoding', payload: VideoTranscodingPayload } |
  { type: 'email', payload: EmailPayload } |
  { type: 'video-import', payload: VideoImportPayload } |
  { type: 'activitypub-refresher', payload: RefreshPayload } |
  { type: 'videos-views', payload: {} } |
  { type: 'video-live-ending', payload: VideoLiveEndingPayload } |
  { type: 'actor-keys', payload: ActorKeysPayload } |
  { type: 'video-redundancy', payload: VideoRedundancyPayload } |
  { type: 'delete-resumable-upload-meta-file', payload: DeleteResumableUploadMetaFilePayload }

type CreateJobOptions = {
  delay?: number
  priority?: number
}

const handlers: { [id in JobType]: (job: Bull.Job) => Promise<any> } = {
  'activitypub-http-broadcast': processActivityPubHttpBroadcast,
  'activitypub-http-unicast': processActivityPubHttpUnicast,
  'activitypub-http-fetcher': processActivityPubHttpFetcher,
  'activitypub-cleaner': processActivityPubCleaner,
  'activitypub-follow': processActivityPubFollow,
  'video-file-import': processVideoFileImport,
  'video-transcoding': processVideoTranscoding,
  'email': processEmail,
  'video-import': processVideoImport,
  'videos-views': processVideosViews,
  'activitypub-refresher': refreshAPObject,
  'video-live-ending': processVideoLiveEnding,
  'actor-keys': processActorKeys,
  'video-redundancy': processVideoRedundancy,
  'delete-resumable-upload-meta-file': processDeleteResumableUploadMetaFile
}

const jobTypes: JobType[] = [
  'activitypub-follow',
  'activitypub-http-broadcast',
  'activitypub-http-fetcher',
  'activitypub-http-unicast',
  'activitypub-cleaner',
  'email',
  'video-transcoding',
  'video-file-import',
  'video-import',
  'videos-views',
  'activitypub-refresher',
  'video-redundancy',
  'actor-keys',
  'video-live-ending',
  'delete-resumable-upload-meta-file'
]

class JobQueue {

  private static instance: JobQueue

  private queues: { [id in JobType]?: Bull.Queue } = {}
  private initialized = false
  private jobRedisPrefix: string

  private constructor () {
  }

  init () {
    // Already initialized
    if (this.initialized === true) return
    this.initialized = true

    this.jobRedisPrefix = 'bull-' + WEBSERVER.HOST
    const queueOptions = {
      prefix: this.jobRedisPrefix,
      redis: Redis.getRedisClientOptions(),
      settings: {
        maxStalledCount: 10 // transcoding could be long, so jobs can often be interrupted by restarts
      }
    }

    for (const handlerName of (Object.keys(handlers) as JobType[])) {
      const queue = new Bull(handlerName, queueOptions)
      const handler = handlers[handlerName]

      queue.process(this.getJobConcurrency(handlerName), handler)
           .catch(err => logger.error('Error in job queue processor %s.', handlerName, { err }))

      queue.on('failed', (job, err) => {
        logger.error('Cannot execute job %d in queue %s.', job.id, handlerName, { payload: job.data, err })
      })

      queue.on('error', err => {
        logger.error('Error in job queue %s.', handlerName, { err })
      })

      this.queues[handlerName] = queue
    }

    this.addRepeatableJobs()
  }

  terminate () {
    for (const queueName of Object.keys(this.queues)) {
      const queue = this.queues[queueName]
      queue.close()
    }
  }

  createJob (obj: CreateJobArgument, options: CreateJobOptions = {}): void {
    this.createJobWithPromise(obj, options)
        .catch(err => logger.error('Cannot create job.', { err, obj }))
  }

  createJobWithPromise (obj: CreateJobArgument, options: CreateJobOptions = {}) {
    const queue = this.queues[obj.type]
    if (queue === undefined) {
      logger.error('Unknown queue %s: cannot create job.', obj.type)
      return
    }

    const jobArgs: Bull.JobOptions = {
      backoff: { delay: 60 * 1000, type: 'exponential' },
      attempts: JOB_ATTEMPTS[obj.type],
      timeout: JOB_TTL[obj.type],
      priority: options.priority,
      delay: options.delay
    }

    return queue.add(obj.payload, jobArgs)
  }

  async listForApi (options: {
    state?: JobState
    start: number
    count: number
    asc?: boolean
    jobType: JobType
  }): Promise<Bull.Job[]> {
    const { state, start, count, asc, jobType } = options

    const states = state ? [ state ] : jobStates
    let results: Bull.Job[] = []

    const filteredJobTypes = this.filterJobTypes(jobType)

    for (const jobType of filteredJobTypes) {
      const queue = this.queues[jobType]
      if (queue === undefined) {
        logger.error('Unknown queue %s to list jobs.', jobType)
        continue
      }

      const jobs = await queue.getJobs(states, 0, start + count, asc)
      results = results.concat(jobs)
    }

    results.sort((j1: any, j2: any) => {
      if (j1.timestamp < j2.timestamp) return -1
      else if (j1.timestamp === j2.timestamp) return 0

      return 1
    })

    if (asc === false) results.reverse()

    return results.slice(start, start + count)
  }

  async count (state: JobState, jobType?: JobType): Promise<number> {
    const states = state ? [ state ] : jobStates
    let total = 0

    const filteredJobTypes = this.filterJobTypes(jobType)

    for (const type of filteredJobTypes) {
      const queue = this.queues[type]
      if (queue === undefined) {
        logger.error('Unknown queue %s to count jobs.', type)
        continue
      }

      const counts = await queue.getJobCounts()

      for (const s of states) {
        total += counts[s]
      }
    }

    return total
  }

  async removeOldJobs () {
    for (const key of Object.keys(this.queues)) {
      const queue = this.queues[key]
      await queue.clean(JOB_COMPLETED_LIFETIME, 'completed')
    }
  }

  private addRepeatableJobs () {
    this.queues['videos-views'].add({}, {
      repeat: REPEAT_JOBS['videos-views']
    }).catch(err => logger.error('Cannot add repeatable job.', { err }))

    if (CONFIG.FEDERATION.VIDEOS.CLEANUP_REMOTE_INTERACTIONS) {
      this.queues['activitypub-cleaner'].add({}, {
        repeat: REPEAT_JOBS['activitypub-cleaner']
      }).catch(err => logger.error('Cannot add repeatable job.', { err }))
    }
  }

  private filterJobTypes (jobType?: JobType) {
    if (!jobType) return jobTypes

    return jobTypes.filter(t => t === jobType)
  }

  private getJobConcurrency (jobType: JobType) {
    if (jobType === 'video-transcoding') return CONFIG.TRANSCODING.CONCURRENCY
    if (jobType === 'video-import') return CONFIG.IMPORT.VIDEOS.CONCURRENCY

    return JOB_CONCURRENCY[jobType]
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  jobTypes,
  JobQueue
}
