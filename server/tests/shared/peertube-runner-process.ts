import { ChildProcess, fork } from 'child_process'
import execa from 'execa'
import { join } from 'path'
import { root } from '@shared/core-utils'
import { PeerTubeServer } from '@shared/server-commands'

export class PeerTubeRunnerProcess {
  private app?: ChildProcess

  constructor (private readonly server: PeerTubeServer) {

  }

  runServer (options: {
    hideLogs?: boolean // default true
  } = {}) {
    const { hideLogs = true } = options

    return new Promise<void>((res, rej) => {
      const args = [ 'server', '--verbose', ...this.buildIdArg() ]

      const forkOptions = {
        detached: false,
        silent: true
      }
      this.app = fork(this.getRunnerPath(), args, forkOptions)

      this.app.stdout.on('data', data => {
        const str = data.toString() as string

        if (!hideLogs) {
          console.log(str)
        }
      })

      res()
    })
  }

  registerPeerTubeInstance (options: {
    registrationToken: string
    runnerName: string
    runnerDescription?: string
  }) {
    const { registrationToken, runnerName, runnerDescription } = options

    const args = [
      'register',
      '--url', this.server.url,
      '--registration-token', registrationToken,
      '--runner-name', runnerName,
      ...this.buildIdArg()
    ]

    if (runnerDescription) {
      args.push('--runner-description')
      args.push(runnerDescription)
    }

    return execa.node(this.getRunnerPath(), args)
  }

  unregisterPeerTubeInstance () {
    const args = [ 'unregister', '--url', this.server.url, ...this.buildIdArg() ]
    return execa.node(this.getRunnerPath(), args)
  }

  async listRegisteredPeerTubeInstances () {
    const args = [ 'list-registered', ...this.buildIdArg() ]
    const { stdout } = await execa.node(this.getRunnerPath(), args)

    return stdout
  }

  kill () {
    if (!this.app) return

    process.kill(this.app.pid)

    this.app = null
  }

  getId () {
    return 'test-' + this.server.internalServerNumber
  }

  private getRunnerPath () {
    return join(root(), 'packages', 'peertube-runner', 'dist', 'peertube-runner.js')
  }

  private buildIdArg () {
    return [ '--id', this.getId() ]
  }
}
