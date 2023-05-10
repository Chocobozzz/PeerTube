import CliTable3 from 'cli-table3'
import { ensureDir } from 'fs-extra'
import { Client as NetIPC } from 'net-ipc'
import { ConfigManager } from '../config-manager'
import { IPCReponse, IPCReponseData, IPCRequest } from './shared'

export class IPCClient {
  private netIPC: NetIPC

  async run () {
    await ensureDir(ConfigManager.Instance.getSocketDirectory())

    const socketPath = ConfigManager.Instance.getSocketPath()
    this.netIPC = new NetIPC({ path: socketPath })
    await this.netIPC.connect()
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

    const { success, error } = await this.netIPC.request(req) as IPCReponse

    if (success) console.log('PeerTube instance registered')
    else console.error('Could not register PeerTube instance on runner server side', error)
  }

  async askUnregister (options: {
    url: string
  }) {
    const req: IPCRequest = {
      type: 'unregister',
      ...options
    }

    const { success, error } = await this.netIPC.request(req) as IPCReponse

    if (success) console.log('PeerTube instance unregistered')
    else console.error('Could not unregister PeerTube instance on runner server side', error)
  }

  async askListRegistered () {
    const req: IPCRequest = {
      type: 'list-registered'
    }

    const { success, error, data } = await this.netIPC.request(req) as IPCReponse<IPCReponseData>
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

  stop () {
    this.netIPC.destroy()
  }
}
