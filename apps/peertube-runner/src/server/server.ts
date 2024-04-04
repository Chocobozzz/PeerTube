import { ensureDir, remove } from 'fs-extra/esm'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { io, Socket } from 'socket.io-client'
import { pick, shuffle, wait } from '@peertube/peertube-core-utils'
import { PeerTubeProblemDocument, ServerErrorCode } from '@peertube/peertube-models'
import { PeerTubeServer as PeerTubeServerCommand } from '@peertube/peertube-server-commands'
import { ConfigManager } from '../shared/index.js'
import { IPCServer } from '../shared/ipc/index.js'
import { logger } from '../shared/logger.js'
import { JobWithToken, processJob } from './process/index.js'
import { isJobSupported } from './shared/index.js'

type PeerTubeServer = PeerTubeServerCommand & {
  runnerToken: string
  runnerName: string
  runnerDescription?: string
}

export class RunnerServer {
  private static instance: RunnerServer

  private servers: PeerTubeServer[] = []
  private processingJobs: { job: JobWithToken, server: PeerTubeServer }[] = []

  private checkingAvailableJobs = false

  private cleaningUp = false
  private initialized = false

  private readonly sockets = new Map<PeerTubeServer, Socket>()

  private constructor () {}

  async run () {
    logger.info('Running PeerTube runner in server mode')

    await ConfigManager.Instance.load()

    for (const registered of ConfigManager.Instance.getConfig().registeredInstances) {
      const serverCommand = new PeerTubeServerCommand({ url: registered.url })

      this.loadServer(Object.assign(serverCommand, registered))

      logger.info(`Loading registered instance ${registered.url}`)
    }

    // Run IPC
    const ipcServer = new IPCServer()
    try {
      await ipcServer.run(this)
    } catch (err) {
      logger.error('Cannot start local socket for IPC communication', err)
      process.exit(-1)
    }

    // Cleanup on exit
    for (const code of [ 'SIGTERM', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'uncaughtException' ]) {
      process.on(code, async (err, origin) => {
        if (code === 'uncaughtException') {
          logger.error({ err, origin }, 'uncaughtException')
        }

        await this.onExit()
      })
    }

    // Process jobs
    await ensureDir(ConfigManager.Instance.getTranscodingDirectory())
    await this.cleanupTMP()

    logger.info(`Using ${ConfigManager.Instance.getTranscodingDirectory()} for transcoding directory`)

    this.initialized = true
    await this.checkAvailableJobs()
  }

  // ---------------------------------------------------------------------------

  async registerRunner (options: {
    url: string
    registrationToken: string
    runnerName: string
    runnerDescription?: string
  }) {
    const { url, registrationToken, runnerName, runnerDescription } = options

    logger.info(`Registering runner ${runnerName} on ${url}...`)

    const serverCommand = new PeerTubeServerCommand({ url })
    const { runnerToken } = await serverCommand.runners.register({ name: runnerName, description: runnerDescription, registrationToken })

    const server: PeerTubeServer = Object.assign(serverCommand, {
      runnerToken,
      runnerName,
      runnerDescription
    })

    this.loadServer(server)
    await this.saveRegisteredInstancesInConf()

    logger.info(`Registered runner ${runnerName} on ${url}`)
  }

  private loadServer (server: PeerTubeServer) {
    this.servers.push(server)

    const url = server.url + '/runners'
    const socket = io(url, {
      auth: {
        runnerToken: server.runnerToken
      },
      transports: [ 'websocket' ]
    })

    socket.on('connect_error', err => logger.warn({ err }, `Cannot connect to ${url} socket`))
    socket.on('available-jobs', () => this.safeAsyncCheckAvailableJobs())

    socket.on('connect', () => {
      logger.info(`Connected to ${url} socket`)

      this.safeAsyncCheckAvailableJobs()
    })
    socket.on('disconnect', () => logger.warn(`Disconnected from ${url} socket`))
    socket.io.on('ping', () => logger.debug(`Received a "ping" for ${url}`))

    this.sockets.set(server, socket)
  }

  async unregisterRunner (options: {
    url: string
    runnerName: string
  }) {
    const { url, runnerName } = options

    const server = this.servers.find(s => s.url === url && s.runnerName === runnerName)
    if (!server) {
      logger.error(`Unknown server ${url} - ${runnerName} to unregister`)
      return
    }

    logger.info(`Unregistering runner ${runnerName} on ${url}...`)

    try {
      await server.runners.unregister({ runnerToken: server.runnerToken })
    } catch (err) {
      logger.error({ err }, `Cannot unregister runner ${runnerName} on ${url}`)
    }

    this.unloadServer(server)
    await this.saveRegisteredInstancesInConf()

    logger.info(`Unregistered runner ${runnerName} on ${url}`)
  }

  private unloadServer (server: PeerTubeServer) {
    this.servers = this.servers.filter(s => s !== server)

    const socket = this.sockets.get(server)
    socket.disconnect()

    this.sockets.delete(server)
  }

  listRegistered () {
    return {
      servers: this.servers.map(s => {
        return {
          url: s.url,
          runnerName: s.runnerName,
          runnerDescription: s.runnerDescription
        }
      })
    }
  }

  // ---------------------------------------------------------------------------

  private safeAsyncCheckAvailableJobs () {
    this.checkAvailableJobs()
      .catch(err => logger.error({ err }, `Cannot check available jobs`))
  }

  private async checkAvailableJobs () {
    if (!this.initialized) return
    if (this.checkingAvailableJobs) return

    this.checkingAvailableJobs = true

    let hadAvailableJob = false

    for (const server of shuffle([ ...this.servers ])) {
      try {
        logger.info('Checking available jobs on ' + server.url)

        const job = await this.requestJob(server)
        if (!job) continue

        hadAvailableJob = true

        await this.tryToExecuteJobAsync(server, job)
      } catch (err) {
        hadAvailableJob = false

        const code = (err.res?.body as PeerTubeProblemDocument)?.code

        if (code === ServerErrorCode.RUNNER_JOB_NOT_IN_PENDING_STATE) {
          logger.debug({ err }, 'Runner job is not in pending state anymore, retry later')
          continue
        }

        if (code === ServerErrorCode.UNKNOWN_RUNNER_TOKEN) {
          logger.error({ err }, `Unregistering ${server.url} as the runner token ${server.runnerToken} is invalid`)

          await this.unregisterRunner({ url: server.url, runnerName: server.runnerName })
          continue
        }

        logger.error({ err }, `Cannot request/accept job on ${server.url} for runner ${server.runnerName}`)
      }
    }

    this.checkingAvailableJobs = false

    if (hadAvailableJob && this.canProcessMoreJobs()) {
      await wait(2500)

      this.checkAvailableJobs()
        .catch(err => logger.error({ err }, 'Cannot check more available jobs'))
    }
  }

  private async requestJob (server: PeerTubeServer) {
    logger.debug(`Requesting jobs on ${server.url} for runner ${server.runnerName}`)

    const { availableJobs } = await server.runnerJobs.request({ runnerToken: server.runnerToken })

    const filtered = availableJobs.filter(j => isJobSupported(j))

    if (filtered.length === 0) {
      logger.debug(`No job available on ${server.url} for runner ${server.runnerName}`)
      return undefined
    }

    return filtered[0]
  }

  private async tryToExecuteJobAsync (server: PeerTubeServer, jobToAccept: { uuid: string }) {
    if (!this.canProcessMoreJobs()) return

    const { job } = await server.runnerJobs.accept({ runnerToken: server.runnerToken, jobUUID: jobToAccept.uuid })

    const processingJob = { job, server }
    this.processingJobs.push(processingJob)

    processJob({ server, job, runnerToken: server.runnerToken })
      .catch(err => {
        logger.error({ err }, 'Cannot process job')

        server.runnerJobs.error({ jobToken: job.jobToken, jobUUID: job.uuid, runnerToken: server.runnerToken, message: err.message })
          .catch(err2 => logger.error({ err: err2 }, 'Cannot abort job after error'))
      })
      .finally(() => {
        this.processingJobs = this.processingJobs.filter(p => p !== processingJob)

        return this.checkAvailableJobs()
      })
  }

  // ---------------------------------------------------------------------------

  private saveRegisteredInstancesInConf () {
    const data = this.servers.map(s => {
      return pick(s, [ 'url', 'runnerToken', 'runnerName', 'runnerDescription' ])
    })

    return ConfigManager.Instance.setRegisteredInstances(data)
  }

  private canProcessMoreJobs () {
    return this.processingJobs.length < ConfigManager.Instance.getConfig().jobs.concurrency
  }

  // ---------------------------------------------------------------------------

  private async cleanupTMP () {
    const files = await readdir(ConfigManager.Instance.getTranscodingDirectory())

    for (const file of files) {
      await remove(join(ConfigManager.Instance.getTranscodingDirectory(), file))
    }
  }

  private async onExit () {
    if (this.cleaningUp) return
    this.cleaningUp = true

    logger.info('Cleaning up after program exit')

    try {
      for (const { server, job } of this.processingJobs) {
        await server.runnerJobs.abort({
          jobToken: job.jobToken,
          jobUUID: job.uuid,
          reason: 'Runner stopped',
          runnerToken: server.runnerToken
        })
      }

      await this.cleanupTMP()
    } catch (err) {
      logger.error(err)
      process.exit(-1)
    }

    process.exit()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
