import { ensureDir } from 'fs-extra/esm'
import { Server as NetIPC } from '@peertube/net-ipc'
import { pick } from '@peertube/peertube-core-utils'
import { RunnerServer } from '../../server/index.js'
import { ConfigManager } from '../config-manager.js'
import { logger } from '../logger.js'
import { IPCResponse, IPCResponseData, IPCRequest } from './shared/index.js'

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

        this.sendResponse(res, { success: true, data })
      } catch (err) {
        logger.error({ err }, 'Cannot execute RPC call')
        this.sendResponse(res, { success: false, error: err.message })
      }
    })
  }

  private async process (req: IPCRequest) {
    switch (req.type) {
      case 'register':
        await this.runnerServer.registerRunner(pick(req, [ 'url', 'registrationToken', 'runnerName', 'runnerDescription' ]))
        return undefined

      case 'unregister':
        await this.runnerServer.unregisterRunner(pick(req, [ 'url', 'runnerName' ]))
        return undefined

      case 'list-registered':
        return Promise.resolve(this.runnerServer.listRegistered())

      case 'graceful-shutdown':
        this.runnerServer.requestGracefulShutdown()
        return undefined

      default:
        throw new Error('Unknown RPC call ' + (req as any).type)
    }
  }

  private sendResponse <T extends IPCResponseData> (
    response: (data: any) => Promise<void>,
    body: IPCResponse<T>
  ) {
    response(body)
      .catch(err => logger.error('Cannot send response after IPC request', err))
  }
}
