import { ChildProcess, fork } from 'child_process'
import execa from 'execa'
import { join } from 'path'
import { root } from '@shared/core-utils'
import { PeerTubeServer } from '@shared/server-commands'

export class PeerTubeRunnerProcess {
  private app?: ChildProcess

  runServer (options: {
    hideLogs?: boolean // default true
  } = {}) {
    const { hideLogs = true } = options

    return new Promise<void>((res, rej) => {
      const args = [ 'server', '--verbose', '--id', 'test' ]

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
    server: PeerTubeServer
    registrationToken: string
    runnerName: string
    runnerDescription?: string
  }) {
    const { server, registrationToken, runnerName, runnerDescription } = options

    const args = [
      'register',
      '--url', server.url,
      '--registration-token', registrationToken,
      '--runner-name', runnerName,
      '--id', 'test'
    ]

    if (runnerDescription) {
      args.push('--runner-description')
      args.push(runnerDescription)
    }

    return execa.node(this.getRunnerPath(), args)
  }

  unregisterPeerTubeInstance (options: {
    server: PeerTubeServer
  }) {
    const { server } = options

    const args = [ 'unregister', '--url', server.url, '--id', 'test' ]
    return execa.node(this.getRunnerPath(), args)
  }

  async listRegisteredPeerTubeInstances () {
    const args = [ 'list-registered', '--id', 'test' ]
    const { stdout } = await execa.node(this.getRunnerPath(), args)

    return stdout
  }

  kill () {
    if (!this.app) return

    process.kill(this.app.pid)

    this.app = null
  }

  private getRunnerPath () {
    return join(root(), 'packages', 'peertube-runner', 'dist', 'peertube-runner.js')
  }
}
