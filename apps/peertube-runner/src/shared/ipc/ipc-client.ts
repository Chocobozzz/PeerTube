import { Client as NetIPC } from 'net-ipc'
import CliTable3 from 'cli-table3'
import { ensureDir } from 'fs-extra/esm'
import { ConfigManager } from '../config-manager.js'
import { IPCRequest, IPCResponse, IPCResponseListJobs, IPCResponseListRegistered } from './shared/index.js'

export class IPCClient {
  private netIPC: NetIPC

  async run () {
    await ensureDir(ConfigManager.Instance.getSocketDirectory())

    const socketPath = ConfigManager.Instance.getSocketPath()

    this.netIPC = new NetIPC({ path: socketPath })

    try {
      await this.netIPC.connect()
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        throw new Error(
          'This runner is not currently running in server mode on this system. ' +
            'Please run it using the `server` command first (in another terminal for example) and then retry your command.',
          { cause: err }
        )
      }

      throw err
    }
  }

  async askRegister (options: {
    url: string
    registrationToken: string
    runnerName: string
    runnerDescription?: string
  }) {
    const req: IPCRequest = {
      type: 'register',
      ...options
    }

    const { success, error } = await this.netIPC.request(req) as IPCResponse

    if (success) console.log('PeerTube instance registered')
    else console.error('Could not register PeerTube instance on runner server side', error)
  }

  async askUnregister (options: {
    url: string
    runnerName: string
  }) {
    const req: IPCRequest = {
      type: 'unregister',
      ...options
    }

    const { success, error } = await this.netIPC.request(req) as IPCResponse

    if (success) console.log('PeerTube instance unregistered')
    else console.error('Could not unregister PeerTube instance on runner server side', error)
  }

  async askListRegistered () {
    const req: IPCRequest = {
      type: 'list-registered'
    }

    const { success, error, data } = await this.netIPC.request(req) as IPCResponse<IPCResponseListRegistered>
    if (!success) {
      console.error('Could not list registered PeerTube instances', error)
      return
    }

    const table = new CliTable3({
      head: [ 'instance', 'runner name', 'runner description' ]
    })

    for (const server of data.servers) {
      table.push([ server.url, server.runnerName, server.runnerDescription ])
    }

    console.log(table.toString())
  }

  async askListJobs (options: {
    includePayload: boolean
  }) {
    const req: IPCRequest = {
      type: 'list-jobs'
    }

    const { success, error, data } = await this.netIPC.request(req) as IPCResponse<IPCResponseListJobs>
    if (!success) {
      console.error('Could not list jobs', error)
      return
    }

    const head = [ 'instance', 'type', 'started', 'progress' ]
    if (options.includePayload) head.push('payload')

    const table = new CliTable3({
      head,
      wordWrap: true,
      wrapOnWordBoundary: false
    })

    for (const { serverUrl, job } of data.processingJobs) {
      const row = [
        serverUrl,
        job.type,

        job.startedAt?.toLocaleString(),

        job.progress !== undefined && job.progress !== null
          ? `${job.progress}%`
          : ''
      ]

      if (options.includePayload) row.push(JSON.stringify(job.payload, undefined, 2))

      table.push(row)
    }

    console.log(`Processing ${data.processingJobs.length}/${data.concurrency} jobs`)
    console.log(table.toString())
  }

  // ---------------------------------------------------------------------------

  async askGracefulShutdown () {
    const req: IPCRequest = { type: 'graceful-shutdown' }

    const { success, error } = await this.netIPC.request(req) as IPCResponse

    if (success) console.log('Graceful shutdown acknowledged by the runner')
    else console.error('Could not graceful shutdown runner', error)
  }

  // ---------------------------------------------------------------------------

  stop () {
    this.netIPC.destroy()
  }
}
