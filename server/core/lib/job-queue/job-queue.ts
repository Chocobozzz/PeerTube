import { pick, timeoutPromise } from '@peertube/peertube-core-utils'
import {
  ActivitypubFollowPayload,
  ActivitypubHttpBroadcastPayload,
  ActivitypubHttpFetcherPayload,
  ActivitypubHttpUnicastPayload,
  ActorKeysPayload,
  AfterVideoChannelImportPayload,
  CreateUserExportPayload,
  EmailPayload,
  FederateVideoPayload,
  GenerateStoryboardPayload,
  ImportUserArchivePayload,
  JobState,
  JobType,
  ManageVideoTorrentPayload,
  MoveStoragePayload,
  NotifyPayload,
  RefreshPayload,
  TranscodingJobBuilderPayload,
  VideoChannelImportPayload,
  VideoFileImportPayload,
  VideoImportPayload,
  VideoLiveEndingPayload,
  VideoRedundancyPayload,
  VideoStudioEditionPayload,
  VideoTranscodingPayload,
  VideoTranscriptionPayload
} from '@peertube/peertube-models'
import { jobStates } from '@server/helpers/custom-validators/jobs.js'
import { CONFIG } from '@server/initializers/config.js'
import { processVideoRedundancy } from '@server/lib/job-queue/handlers/video-redundancy.js'
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
import { logger } from '../../helpers/logger.js'
import { JOB_ATTEMPTS, JOB_CONCURRENCY, JOB_REMOVAL_OPTIONS, JOB_TTL, REPEAT_JOBS, WEBSERVER } from '../../initializers/constants.js'
import { Hooks } from '../plugins/hooks.js'
import { Redis } from '../redis.js'
import { processActivityPubCleaner } from './handlers/activitypub-cleaner.js'
import { processActivityPubFollow } from './handlers/activitypub-follow.js'
import {
  processActivityPubHttpSequentialBroadcast,
  processActivityPubParallelHttpBroadcast
} from './handlers/activitypub-http-broadcast.js'
import { processActivityPubHttpFetcher } from './handlers/activitypub-http-fetcher.js'
import { processActivityPubHttpUnicast } from './handlers/activitypub-http-unicast.js'
import { refreshAPObject } from './handlers/activitypub-refresher.js'
import { processActorKeys } from './handlers/actor-keys.js'
import { processAfterVideoChannelImport } from './handlers/after-video-channel-import.js'
import { processCreateUserExport } from './handlers/create-user-export.js'
import { processEmail } from './handlers/email.js'
import { processFederateVideo } from './handlers/federate-video.js'
import { processGenerateStoryboard } from './handlers/generate-storyboard.js'
import { processImportUserArchive } from './handlers/import-user-archive.js'
import { processManageVideoTorrent } from './handlers/manage-video-torrent.js'
import { onMoveToFileSystemFailure, processMoveToFileSystem } from './handlers/move-to-file-system.js'
import { onMoveToObjectStorageFailure, processMoveToObjectStorage } from './handlers/move-to-object-storage.js'
import { processNotify } from './handlers/notify.js'
import { processTranscodingJobBuilder } from './handlers/transcoding-job-builder.js'
import { processVideoChannelImport } from './handlers/video-channel-import.js'
import { processVideoFileImport } from './handlers/video-file-import.js'
import { processVideoImport } from './handlers/video-import.js'
import { processVideoLiveEnding } from './handlers/video-live-ending.js'
import { processVideoStudioEdition } from './handlers/video-studio-edition.js'
import { processVideoTranscoding } from './handlers/video-transcoding.js'
import { processVideoTranscription } from './handlers/video-transcription.js'
import { processVideosViewsStats } from './handlers/video-views-stats.js'

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
  { type: 'video-studio-edition', payload: VideoStudioEditionPayload } |
  { type: 'manage-video-torrent', payload: ManageVideoTorrentPayload } |
  { type: 'move-to-object-storage', payload: MoveStoragePayload } |
  { type: 'move-to-file-system', payload: MoveStoragePayload } |
  { type: 'video-channel-import', payload: VideoChannelImportPayload } |
  { type: 'after-video-channel-import', payload: AfterVideoChannelImportPayload } |
  { type: 'notify', payload: NotifyPayload } |
  { type: 'federate-video', payload: FederateVideoPayload } |
  { type: 'create-user-export', payload: CreateUserExportPayload } |
  { type: 'generate-video-storyboard', payload: GenerateStoryboardPayload } |
  { type: 'import-user-archive', payload: ImportUserArchivePayload } |
  { type: 'video-transcription', payload: VideoTranscriptionPayload }

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
  'move-to-file-system': processMoveToFileSystem,
  'notify': processNotify,
  'video-channel-import': processVideoChannelImport,
  'video-file-import': processVideoFileImport,
  'video-import': processVideoImport,
  'video-live-ending': processVideoLiveEnding,
  'video-redundancy': processVideoRedundancy,
  'video-studio-edition': processVideoStudioEdition,
  'video-transcoding': processVideoTranscoding,
  'videos-views-stats': processVideosViewsStats,
  'generate-video-storyboard': processGenerateStoryboard,
  'create-user-export': processCreateUserExport,
  'import-user-archive': processImportUserArchive,
  'video-transcription': processVideoTranscription
}

const errorHandlers: { [id in JobType]?: (job: Job, err: any) => Promise<any> } = {
  'move-to-object-storage': onMoveToObjectStorageFailure,
  'move-to-file-system': onMoveToFileSystemFailure
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
  'move-to-file-system',
  'notify',
  'transcoding-job-builder',
  'video-channel-import',
  'video-file-import',
  'video-import',
  'video-live-ending',
  'video-redundancy',
  'video-studio-edition',
  'video-transcription',
  'videos-views-stats',
  'create-user-export',
  'import-user-archive',
  'video-transcoding'
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

    queue.removeDeprecatedPriorityKey()
      .catch(err => logger.error('Cannot remove bullmq deprecated priority keys of ' + handlerName, { err }))
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

  createJob (options: CreateJobArgument & CreateJobOptions | undefined) {
    if (!options) return

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

    logger.debug('Creating jobs in local job queue', { jobs })

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

      let jobs = await queue.getJobs(states, 0, start + count, asc)

      // FIXME: we have sometimes undefined values https://github.com/taskforcesh/bullmq/issues/248
      jobs = jobs.filter(j => !!j)

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
    const states = this.buildStateFilter(state)
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
    if (!state) return Array.from(jobStates)

    const states = [ state ]

    // Include parent and prioritized if filtering on waiting
    if (state === 'waiting') {
      states.push('waiting-children')
      states.push('prioritized')
    }

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
  JobQueue, jobTypes
}
