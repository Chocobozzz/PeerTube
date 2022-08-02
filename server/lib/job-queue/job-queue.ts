import Bull, { Job, JobOptions, Queue } from 'bull'
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
  ManageVideoTorrentPayload,
  MoveObjectStoragePayload,
  RefreshPayload,
  VideoFileImportPayload,
  VideoImportPayload,
  VideoLiveEndingPayload,
  VideoRedundancyPayload,
  VideoStudioEditionPayload,
  VideoTranscodingPayload
} from '../../../shared/models'
import { logger } from '../../helpers/logger'
import { JOB_ATTEMPTS, JOB_COMPLETED_LIFETIME, JOB_CONCURRENCY, JOB_TTL, REPEAT_JOBS, WEBSERVER } from '../../initializers/constants'
import { Hooks } from '../plugins/hooks'
import { processActivityPubCleaner } from './handlers/activitypub-cleaner'
import { processActivityPubFollow } from './handlers/activitypub-follow'
import { processActivityPubHttpBroadcast } from './handlers/activitypub-http-broadcast'
import { processActivityPubHttpFetcher } from './handlers/activitypub-http-fetcher'
import { processActivityPubHttpUnicast } from './handlers/activitypub-http-unicast'
import { refreshAPObject } from './handlers/activitypub-refresher'
import { processActorKeys } from './handlers/actor-keys'
import { processEmail } from './handlers/email'
import { processManageVideoTorrent } from './handlers/manage-video-torrent'
import { onMoveToObjectStorageFailure, processMoveToObjectStorage } from './handlers/move-to-object-storage'
import { processVideoFileImport } from './handlers/video-file-import'
import { processVideoImport } from './handlers/video-import'
import { processVideoLiveEnding } from './handlers/video-live-ending'
import { processVideoStudioEdition } from './handlers/video-studio-edition'
import { processVideoTranscoding } from './handlers/video-transcoding'
import { processVideosViewsStats } from './handlers/video-views-stats'

type CreateJobArgument =
  { type: 'activitypub-http-broadcast', payload: ActivitypubHttpBroadcastPayload } |
  { type: 'activitypub-http-broadcast-parallel', payload: ActivitypubHttpBroadcastPayload } |
  { type: 'activitypub-http-unicast', payload: ActivitypubHttpUnicastPayload } |
  { type: 'activitypub-http-fetcher', payload: ActivitypubHttpFetcherPayload } |
  { type: 'activitypub-http-cleaner', payload: {} } |
  { type: 'activitypub-follow', payload: ActivitypubFollowPayload } |
  { type: 'video-file-import', payload: VideoFileImportPayload } |
  { type: 'video-transcoding', payload: VideoTranscodingPayload } |
  { type: 'email', payload: EmailPayload } |
  { type: 'video-import', payload: VideoImportPayload } |
  { type: 'activitypub-refresher', payload: RefreshPayload } |
  { type: 'videos-views-stats', payload: {} } |
  { type: 'video-live-ending', payload: VideoLiveEndingPayload } |
  { type: 'actor-keys', payload: ActorKeysPayload } |
  { type: 'video-redundancy', payload: VideoRedundancyPayload } |
  { type: 'delete-resumable-upload-meta-file', payload: DeleteResumableUploadMetaFilePayload } |
  { type: 'video-studio-edition', payload: VideoStudioEditionPayload } |
  { type: 'manage-video-torrent', payload: ManageVideoTorrentPayload } |
  { type: 'move-to-object-storage', payload: MoveObjectStoragePayload }

export type CreateJobOptions = {
  delay?: number
  priority?: number
}

const handlers: { [id in JobType]: (job: Job) => Promise<any> } = {
  'activitypub-http-broadcast': processActivityPubHttpBroadcast,
  'activitypub-http-broadcast-parallel': processActivityPubHttpBroadcast,
  'activitypub-http-unicast': processActivityPubHttpUnicast,
  'activitypub-http-fetcher': processActivityPubHttpFetcher,
  'activitypub-cleaner': processActivityPubCleaner,
  'activitypub-follow': processActivityPubFollow,
  'video-file-import': processVideoFileImport,
  'video-transcoding': processVideoTranscoding,
  'email': processEmail,
  'video-import': processVideoImport,
  'videos-views-stats': processVideosViewsStats,
  'activitypub-refresher': refreshAPObject,
  'video-live-ending': processVideoLiveEnding,
  'actor-keys': processActorKeys,
  'video-redundancy': processVideoRedundancy,
  'move-to-object-storage': processMoveToObjectStorage,
  'manage-video-torrent': processManageVideoTorrent,
  'video-studio-edition': processVideoStudioEdition
}

const errorHandlers: { [id in JobType]?: (job: Job, err: any) => Promise<any> } = {
  'move-to-object-storage': onMoveToObjectStorageFailure
}

const jobTypes: JobType[] = [
  'activitypub-follow',
  'activitypub-http-broadcast',
  'activitypub-http-broadcast-parallel',
  'activitypub-http-fetcher',
  'activitypub-http-unicast',
  'activitypub-cleaner',
  'email',
  'video-transcoding',
  'video-file-import',
  'video-import',
  'videos-views-stats',
  'activitypub-refresher',
  'video-redundancy',
  'actor-keys',
  'video-live-ending',
  'move-to-object-storage',
  'manage-video-torrent',
  'video-studio-edition'
]

const silentFailure = new Set<JobType>([ 'activitypub-http-unicast' ])

class JobQueue {

  private static instance: JobQueue

  private queues: { [id in JobType]?: Queue } = {}
  private initialized = false
  private jobRedisPrefix: string

  private constructor () {
  }

  init (produceOnly = false) {
    // Already initialized
    if (this.initialized === true) return
    this.initialized = true

    this.jobRedisPrefix = 'bull-' + WEBSERVER.HOST

    const queueOptions: Bull.QueueOptions = {
      prefix: this.jobRedisPrefix,
      redis: {
        password: CONFIG.REDIS.AUTH,
        db: CONFIG.REDIS.DB,
        host: CONFIG.REDIS.HOSTNAME,
        port: CONFIG.REDIS.PORT,
        path: CONFIG.REDIS.SOCKET
      },
      settings: {
        maxStalledCount: 10 // transcoding could be long, so jobs can often be interrupted by restarts
      }
    }

    for (const handlerName of (Object.keys(handlers) as JobType[])) {
      const queue = new Bull(handlerName, queueOptions)

      if (produceOnly) {
        queue.pause(true)
             .catch(err => logger.error('Cannot pause queue %s in produced only job queue', handlerName, { err }))
      }

      const handler = handlers[handlerName]

      queue.process(this.getJobConcurrency(handlerName), async (jobArg: Job<any>) => {
        const job = await Hooks.wrapObject(jobArg, 'filter:job-queue.process.params', { type: handlerName })

        return Hooks.wrapPromiseFun(handler, job, 'filter:job-queue.process.result')
      }).catch(err => logger.error('Error in job queue processor %s.', handlerName, { err }))

      queue.on('failed', (job, err) => {
        const logLevel = silentFailure.has(handlerName)
          ? 'debug'
          : 'error'

        logger.log(logLevel, 'Cannot execute job %d in queue %s.', job.id, handlerName, { payload: job.data, err })

        if (errorHandlers[job.name]) {
          errorHandlers[job.name](job, err)
            .catch(err => logger.error('Cannot run error handler for job failure %d in queue %s.', job.id, handlerName, { err }))
        }
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

  async pause () {
    for (const handler of Object.keys(this.queues)) {
      await this.queues[handler].pause(true)
    }
  }

  async resume () {
    for (const handler of Object.keys(this.queues)) {
      await this.queues[handler].resume(true)
    }
  }

  createJob (obj: CreateJobArgument, options: CreateJobOptions = {}): void {
    this.createJobWithPromise(obj, options)
        .catch(err => logger.error('Cannot create job.', { err, obj }))
  }

  createJobWithPromise (obj: CreateJobArgument, options: CreateJobOptions = {}) {
    const queue: Queue = this.queues[obj.type]
    if (queue === undefined) {
      logger.error('Unknown queue %s: cannot create job.', obj.type)
      return
    }

    const jobArgs: JobOptions = {
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
  }): Promise<Job[]> {
    const { state, start, count, asc, jobType } = options

    const states = state ? [ state ] : jobStates
    let results: Job[] = []

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

  async getStats () {
    const promises = jobTypes.map(async t => ({ jobType: t, counts: await this.queues[t].getJobCounts() }))

    return Promise.all(promises)
  }

  async removeOldJobs () {
    for (const key of Object.keys(this.queues)) {
      const queue = this.queues[key]
      await queue.clean(JOB_COMPLETED_LIFETIME, 'completed')
    }
  }

  private addRepeatableJobs () {
    this.queues['videos-views-stats'].add({}, {
      repeat: REPEAT_JOBS['videos-views-stats']
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
