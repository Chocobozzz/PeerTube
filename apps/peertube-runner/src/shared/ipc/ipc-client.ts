import CliTable3 from 'cli-table3'
import { ensureDir } from 'fs-extra/esm'
import { Client as NetIPC } from '@peertube/net-ipc'
import { ConfigManager } from '../config-manager.js'
import { IPCResponse, IPCResponseData, IPCRequest } from './shared/index.js'

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
          'Please run it using the `server` command first (in another terminal for example) and then retry your command.'
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

    const { success, error, data } = await this.netIPC.request(req) as IPCResponse<IPCResponseData>
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
