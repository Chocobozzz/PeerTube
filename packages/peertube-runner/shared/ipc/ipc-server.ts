import { ensureDir } from 'fs-extra'
import { Server as NetIPC } from 'net-ipc'
import { pick } from '@shared/core-utils'
import { RunnerServer } from '../../server'
import { ConfigManager } from '../config-manager'
import { logger } from '../logger'
import { IPCReponse, IPCReponseData, IPCRequest } from './shared'

export class IPCServer {
  private netIPC: NetIPC
  private runnerServer: RunnerServer

  async run (runnerServer: RunnerServer) {
    this.runnerServer = runnerServer

    await ensureDir(ConfigManager.Instance.getSocketDirectory())

    const socketPath = ConfigManager.Instance.getSocketPath()
    this.netIPC = new NetIPC({ path: socketPath })
    await this.netIPC.start()

    logger.info(`IPC socket created on ${socketPath}`)

    this.netIPC.on('request', async (req: IPCRequest, res) => {
      try {
        const data = await this.process(req)

        this.sendReponse(res, { success: true, data })
      } catch (err) {
        logger.error('Cannot execute RPC call', err)
        this.sendReponse(res, { success: false, error: err.message })
      }
    })
  }

  private async process (req: IPCRequest) {
    switch (req.type) {
      case 'register':
        await this.runnerServer.registerRunner(pick(req, [ 'url', 'registrationToken', 'runnerName', 'runnerDescription' ]))
        return undefined

      case 'unregister':
        await this.runnerServer.unregisterRunner({ url: req.url })
        return undefined

      case 'list-registered':
        return Promise.resolve(this.runnerServer.listRegistered())

      default:
        throw new Error('Unknown RPC call ' + (req as any).type)
    }
  }

  private sendReponse <T extends IPCReponseData> (
    response: (data: any) => Promise<void>,
    body: IPCReponse<T>
  ) {
    response(body)
      .catch(err => logger.error('Cannot send response after IPC request', err))
  }
}
