import {
  FlowJob,
  FlowProducer,
  Job,
  JobsOptions,
  Queue,
  QueueEvents,
  QueueEventsOptions,
  QueueOptions,
  Worker,
  WorkerOptions
} from 'bullmq'
import { parseDurationToMs } from '@server/helpers/core-utils'
import { jobStates } from '@server/helpers/custom-validators/jobs'
import { CONFIG } from '@server/initializers/config'
import { processVideoRedundancy } from '@server/lib/job-queue/handlers/video-redundancy'
import { pick, timeoutPromise } from '@shared/core-utils'
import {
  ActivitypubFollowPayload,
  ActivitypubHttpBroadcastPayload,
  ActivitypubHttpFetcherPayload,
  ActivitypubHttpUnicastPayload,
  ActorKeysPayload,
  AfterVideoChannelImportPayload,
  DeleteResumableUploadMetaFilePayload,
  EmailPayload,
  FederateVideoPayload,
  GenerateStoryboardPayload,
  JobState,
  JobType,
  ManageVideoTorrentPayload,
  MoveObjectStoragePayload,
  NotifyPayload,
  RefreshPayload,
  TranscodingJobBuilderPayload,
  VideoChannelImportPayload,
  VideoFileImportPayload,
  VideoImportPayload,
  VideoLiveEndingPayload,
  VideoRedundancyPayload,
  VideoStudioEditionPayload,
  VideoTranscodingPayload
} from '../../../shared/models'
import { logger } from '../../helpers/logger'
import { JOB_ATTEMPTS, JOB_CONCURRENCY, JOB_REMOVAL_OPTIONS, JOB_TTL, REPEAT_JOBS, WEBSERVER } from '../../initializers/constants'
import { Hooks } from '../plugins/hooks'
import { Redis } from '../redis'
import { processActivityPubCleaner } from './handlers/activitypub-cleaner'
import { processActivityPubFollow } from './handlers/activitypub-follow'
import { processActivityPubHttpSequentialBroadcast, processActivityPubParallelHttpBroadcast } from './handlers/activitypub-http-broadcast'
import { processActivityPubHttpFetcher } from './handlers/activitypub-http-fetcher'
import { processActivityPubHttpUnicast } from './handlers/activitypub-http-unicast'
import { refreshAPObject } from './handlers/activitypub-refresher'
import { processActorKeys } from './handlers/actor-keys'
import { processAfterVideoChannelImport } from './handlers/after-video-channel-import'
import { processEmail } from './handlers/email'
import { processFederateVideo } from './handlers/federate-video'
import { processManageVideoTorrent } from './handlers/manage-video-torrent'
import { onMoveToObjectStorageFailure, processMoveToObjectStorage } from './handlers/move-to-object-storage'
import { processNotify } from './handlers/notify'
import { processTranscodingJobBuilder } from './handlers/transcoding-job-builder'
import { processVideoChannelImport } from './handlers/video-channel-import'
import { processVideoFileImport } from './handlers/video-file-import'
import { processVideoImport } from './handlers/video-import'
import { processVideoLiveEnding } from './handlers/video-live-ending'
import { processVideoStudioEdition } from './handlers/video-studio-edition'
import { processVideoTranscoding } from './handlers/video-transcoding'
import { processVideosViewsStats } from './handlers/video-views-stats'
import { processGenerateStoryboard } from './handlers/generate-storyboard'

export type CreateJobArgument =
  { type: 'activitypub-http-broadcast', payload: ActivitypubHttpBroadcastPayload } |
  { type: 'activitypub-http-broadcast-parallel', payload: ActivitypubHttpBroadcastPayload } |
  { type: 'activitypub-http-unicast', payload: ActivitypubHttpUnicastPayload } |
  { type: 'activitypub-http-fetcher', payload: ActivitypubHttpFetcherPayload } |
  { type: 'activitypub-cleaner', payload: {} } |
  { type: 'activitypub-follow', payload: ActivitypubFollowPayload } |
  { type: 'video-file-import', payload: VideoFileImportPayload } |
  { type: 'video-transcoding', payload: VideoTranscodingPayload } |
  { type: 'email', payload: EmailPayload } |
  { type: 'transcoding-job-builder', payload: TranscodingJobBuilderPayload } |
  { type: 'video-import', payload: VideoImportPayload } |
  { type: 'activitypub-refresher', payload: RefreshPayload } |
  { type: 'videos-views-stats', payload: {} } |
  { type: 'video-live-ending', payload: VideoLiveEndingPayload } |
  { type: 'actor-keys', payload: ActorKeysPayload } |
  { type: 'video-redundancy', payload: VideoRedundancyPayload } |
  { type: 'delete-resumable-upload-meta-file', payload: DeleteResumableUploadMetaFilePayload } |
  { type: 'video-studio-edition', payload: VideoStudioEditionPayload } |
  { type: 'manage-video-torrent', payload: ManageVideoTorrentPayload } |
  { type: 'move-to-object-storage', payload: MoveObjectStoragePayload } |
  { type: 'video-channel-import', payload: VideoChannelImportPayload } |
  { type: 'after-video-channel-import', payload: AfterVideoChannelImportPayload } |
  { type: 'notify', payload: NotifyPayload } |
  { type: 'move-to-object-storage', payload: MoveObjectStoragePayload } |
  { type: 'federate-video', payload: FederateVideoPayload } |
  { type: 'generate-video-storyboard', payload: GenerateStoryboardPayload }

export type CreateJobOptions = {
  delay?: number
  priority?: number
  failParentOnFailure?: boolean
}

const handlers: { [id in JobType]: (job: Job) => Promise<any> } = {
  'activitypub-cleaner': processActivityPubCleaner,
  'activitypub-follow': processActivityPubFollow,
  'activitypub-http-broadcast-parallel': processActivityPubParallelHttpBroadcast,
  'activitypub-http-broadcast': processActivityPubHttpSequentialBroadcast,
  'activitypub-http-fetcher': processActivityPubHttpFetcher,
  'activitypub-http-unicast': processActivityPubHttpUnicast,
  'activitypub-refresher': refreshAPObject,
  'actor-keys': processActorKeys,
  'after-video-channel-import': processAfterVideoChannelImport,
  'email': processEmail,
  'federate-video': processFederateVideo,
  'transcoding-job-builder': processTranscodingJobBuilder,
  'manage-video-torrent': processManageVideoTorrent,
  'move-to-object-storage': processMoveToObjectStorage,
  'notify': processNotify,
  'video-channel-import': processVideoChannelImport,
  'video-file-import': processVideoFileImport,
  'video-import': processVideoImport,
  'video-live-ending': processVideoLiveEnding,
  'video-redundancy': processVideoRedundancy,
  'video-studio-edition': processVideoStudioEdition,
  'video-transcoding': processVideoTranscoding,
  'videos-views-stats': processVideosViewsStats,
  'generate-video-storyboard': processGenerateStoryboard
}

const errorHandlers: { [id in JobType]?: (job: Job, err: any) => Promise<any> } = {
  'move-to-object-storage': onMoveToObjectStorageFailure
}

const jobTypes: JobType[] = [
  'activitypub-cleaner',
  'activitypub-follow',
  'activitypub-http-broadcast-parallel',
  'activitypub-http-broadcast',
  'activitypub-http-fetcher',
  'activitypub-http-unicast',
  'activitypub-refresher',
  'actor-keys',
  'after-video-channel-import',
  'email',
  'federate-video',
  'generate-video-storyboard',
  'manage-video-torrent',
  'move-to-object-storage',
  'notify',
  'transcoding-job-builder',
  'video-channel-import',
  'video-file-import',
  'video-import',
  'video-live-ending',
  'video-redundancy',
  'video-studio-edition',
  'video-transcoding',
  'videos-views-stats'
]

const silentFailure = new Set<JobType>([ 'activitypub-http-unicast' ])

class JobQueue {

  private static instance: JobQueue

  private workers: { [id in JobType]?: Worker } = {}
  private queues: { [id in JobType]?: Queue } = {}
  private queueEvents: { [id in JobType]?: QueueEvents } = {}

  private flowProducer: FlowProducer

  private initialized = false
  private jobRedisPrefix: string

  private constructor () {
  }

  init () {
    // Already initialized
    if (this.initialized === true) return
    this.initialized = true

    this.jobRedisPrefix = 'bull-' + WEBSERVER.HOST

    for (const handlerName of Object.keys(handlers)) {
      this.buildWorker(handlerName)
      this.buildQueue(handlerName)
      this.buildQueueEvent(handlerName)
    }

    this.flowProducer = new FlowProducer({
      connection: Redis.getRedisClientOptions('FlowProducer'),
      prefix: this.jobRedisPrefix
    })
    this.flowProducer.on('error', err => { logger.error('Error in flow producer', { err }) })

    this.addRepeatableJobs()
  }

  private buildWorker (handlerName: JobType) {
    const workerOptions: WorkerOptions = {
      autorun: false,
      concurrency: this.getJobConcurrency(handlerName),
      prefix: this.jobRedisPrefix,
      connection: Redis.getRedisClientOptions('Worker'),
      maxStalledCount: 10
    }

    const handler = function (job: Job) {
      const timeout = JOB_TTL[handlerName]
      const p = handlers[handlerName](job)

      if (!timeout) return p

      return timeoutPromise(p, timeout)
    }

    const processor = async (jobArg: Job<any>) => {
      const job = await Hooks.wrapObject(jobArg, 'filter:job-queue.process.params', { type: handlerName })

      return Hooks.wrapPromiseFun(handler, job, 'filter:job-queue.process.result')
    }

    const worker = new Worker(handlerName, processor, workerOptions)

    worker.on('failed', (job, err) => {
      const logLevel = silentFailure.has(handlerName)
        ? 'debug'
        : 'error'

      logger.log(logLevel, 'Cannot execute job %s in queue %s.', job.id, handlerName, { payload: job.data, err })

      if (errorHandlers[job.name]) {
        errorHandlers[job.name](job, err)
          .catch(err => logger.error('Cannot run error handler for job failure %d in queue %s.', job.id, handlerName, { err }))
      }
    })

    worker.on('error', err => { logger.error('Error in job worker %s.', handlerName, { err }) })

    this.workers[handlerName] = worker
  }

  private buildQueue (handlerName: JobType) {
    const queueOptions: QueueOptions = {
      connection: Redis.getRedisClientOptions('Queue'),
      prefix: this.jobRedisPrefix
    }

    const queue = new Queue(handlerName, queueOptions)
    queue.on('error', err => { logger.error('Error in job queue %s.', handlerName, { err }) })

    this.queues[handlerName] = queue
  }

  private buildQueueEvent (handlerName: JobType) {
    const queueEventsOptions: QueueEventsOptions = {
      autorun: false,
      connection: Redis.getRedisClientOptions('QueueEvent'),
      prefix: this.jobRedisPrefix
    }

    const queueEvents = new QueueEvents(handlerName, queueEventsOptions)
    queueEvents.on('error', err => { logger.error('Error in job queue events %s.', handlerName, { err }) })

    this.queueEvents[handlerName] = queueEvents
  }

  // ---------------------------------------------------------------------------

  async terminate () {
    const promises = Object.keys(this.workers)
      .map(handlerName => {
        const worker: Worker = this.workers[handlerName]
        const queue: Queue = this.queues[handlerName]
        const queueEvent: QueueEvents = this.queueEvents[handlerName]

        return Promise.all([
          worker.close(false),
          queue.close(),
          queueEvent.close()
        ])
      })

    return Promise.all(promises)
  }

  start () {
    const promises = Object.keys(this.workers)
      .map(handlerName => {
        const worker: Worker = this.workers[handlerName]
        const queueEvent: QueueEvents = this.queueEvents[handlerName]

        return Promise.all([
          worker.run(),
          queueEvent.run()
        ])
      })

    return Promise.all(promises)
  }

  async pause () {
    for (const handlerName of Object.keys(this.workers)) {
      const worker: Worker = this.workers[handlerName]

      await worker.pause()
    }
  }

  resume () {
    for (const handlerName of Object.keys(this.workers)) {
      const worker: Worker = this.workers[handlerName]

      worker.resume()
    }
  }

  // ---------------------------------------------------------------------------

  createJobAsync (options: CreateJobArgument & CreateJobOptions): void {
    this.createJob(options)
        .catch(err => logger.error('Cannot create job.', { err, options }))
  }

  createJob (options: CreateJobArgument & CreateJobOptions) {
    const queue: Queue = this.queues[options.type]
    if (queue === undefined) {
      logger.error('Unknown queue %s: cannot create job.', options.type)
      return
    }

    const jobOptions = this.buildJobOptions(options.type as JobType, pick(options, [ 'priority', 'delay' ]))

    return queue.add('job', options.payload, jobOptions)
  }

  createSequentialJobFlow (...jobs: ((CreateJobArgument & CreateJobOptions) | undefined)[]) {
    let lastJob: FlowJob

    for (const job of jobs) {
      if (!job) continue

      lastJob = {
        ...this.buildJobFlowOption(job),

        children: lastJob
          ? [ lastJob ]
          : []
      }
    }

    return this.flowProducer.add(lastJob)
  }

  createJobWithChildren (parent: CreateJobArgument & CreateJobOptions, children: (CreateJobArgument & CreateJobOptions)[]) {
    return this.flowProducer.add({
      ...this.buildJobFlowOption(parent),

      children: children.map(c => this.buildJobFlowOption(c))
    })
  }

  private buildJobFlowOption (job: CreateJobArgument & CreateJobOptions): FlowJob {
    return {
      name: 'job',
      data: job.payload,
      queueName: job.type,
      opts: {
        failParentOnFailure: true,

        ...this.buildJobOptions(job.type as JobType, pick(job, [ 'priority', 'delay', 'failParentOnFailure' ]))
      }
    }
  }

  private buildJobOptions (type: JobType, options: CreateJobOptions = {}): JobsOptions {
    return {
      backoff: { delay: 60 * 1000, type: 'exponential' },
      attempts: JOB_ATTEMPTS[type],
      priority: options.priority,
      delay: options.delay,

      ...this.buildJobRemovalOptions(type)
    }
  }

  // ---------------------------------------------------------------------------

  async listForApi (options: {
    state?: JobState
    start: number
    count: number
    asc?: boolean
    jobType: JobType
  }): Promise<Job[]> {
    const { state, start, count, asc, jobType } = options

    const states = this.buildStateFilter(state)
    const filteredJobTypes = this.buildTypeFilter(jobType)

    let results: Job[] = []

    for (const jobType of filteredJobTypes) {
      const queue: Queue = this.queues[jobType]

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
    const filteredJobTypes = this.buildTypeFilter(jobType)

    let total = 0

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

  private buildStateFilter (state?: JobState) {
    if (!state) return jobStates

    const states = [ state ]

    // Include parent if filtering on waiting
    if (state === 'waiting') states.push('waiting-children')

    return states
  }

  private buildTypeFilter (jobType?: JobType) {
    if (!jobType) return jobTypes

    return jobTypes.filter(t => t === jobType)
  }

  async getStats () {
    const promises = jobTypes.map(async t => ({ jobType: t, counts: await this.queues[t].getJobCounts() }))

    return Promise.all(promises)
  }

  // ---------------------------------------------------------------------------

  async removeOldJobs () {
    for (const key of Object.keys(this.queues)) {
      const queue: Queue = this.queues[key]
      await queue.clean(parseDurationToMs('7 days'), 1000, 'completed')
      await queue.clean(parseDurationToMs('7 days'), 1000, 'failed')
    }
  }

  private addRepeatableJobs () {
    this.queues['videos-views-stats'].add('job', {}, {
      repeat: REPEAT_JOBS['videos-views-stats'],

      ...this.buildJobRemovalOptions('videos-views-stats')
    }).catch(err => logger.error('Cannot add repeatable job.', { err }))

    if (CONFIG.FEDERATION.VIDEOS.CLEANUP_REMOTE_INTERACTIONS) {
      this.queues['activitypub-cleaner'].add('job', {}, {
        repeat: REPEAT_JOBS['activitypub-cleaner'],

        ...this.buildJobRemovalOptions('activitypub-cleaner')
      }).catch(err => logger.error('Cannot add repeatable job.', { err }))
    }
  }

  private getJobConcurrency (jobType: JobType) {
    if (jobType === 'video-transcoding') return CONFIG.TRANSCODING.CONCURRENCY
    if (jobType === 'video-import') return CONFIG.IMPORT.VIDEOS.CONCURRENCY

    return JOB_CONCURRENCY[jobType]
  }

  private buildJobRemovalOptions (queueName: string) {
    return {
      removeOnComplete: {
        // Wants seconds
        age: (JOB_REMOVAL_OPTIONS.SUCCESS[queueName] || JOB_REMOVAL_OPTIONS.SUCCESS.DEFAULT) / 1000,

        count: JOB_REMOVAL_OPTIONS.COUNT
      },
      removeOnFail: {
        // Wants seconds
        age: (JOB_REMOVAL_OPTIONS.FAILURE[queueName] || JOB_REMOVAL_OPTIONS.FAILURE.DEFAULT) / 1000,

        count: JOB_REMOVAL_OPTIONS.COUNT / 1000
      }
    }
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
