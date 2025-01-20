import { RunnerJobType } from '@peertube/peertube-models'
import { root } from '@peertube/peertube-node-utils'
import { PeerTubeServer } from '@peertube/peertube-server-commands'
import { ChildProcess, fork, ForkOptions } from 'child_process'
import { execaNode } from 'execa'
import { join } from 'path'

export class PeerTubeRunnerProcess {
  private app?: ChildProcess

  constructor (private readonly server: PeerTubeServer) {

  }

  runServer (options: {
    jobType?: RunnerJobType
    hideLogs?: boolean // default true
  } = {}) {
    const { jobType, hideLogs = true } = options

    return new Promise<void>((res, rej) => {
      const args = [ 'server', '--verbose', ...this.buildIdArg() ]

      if (jobType) {
        args.push('--enable-job')
        args.push(jobType)
      }

      const forkOptions: ForkOptions = {
        detached: false,
        silent: true,
        execArgv: [] // Don't inject parent node options
      }

      this.app = fork(this.getRunnerPath(), args, forkOptions)

      this.app.stderr.on('data', data => {
        console.error(data.toString())
      })

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

    return this.runCommand(this.getRunnerPath(), args)
  }

  unregisterPeerTubeInstance (options: {
    runnerName: string
  }) {
    const { runnerName } = options

    const args = [ 'unregister', '--url', this.server.url, '--runner-name', runnerName, ...this.buildIdArg() ]
    return this.runCommand(this.getRunnerPath(), args)
  }

  async listRegisteredPeerTubeInstances () {
    const args = [ 'list-registered', ...this.buildIdArg() ]
    const { stdout } = await this.runCommand(this.getRunnerPath(), args)

    return stdout
  }

  // ---------------------------------------------------------------------------

  gracefulShutdown () {
    const args = [ 'graceful-shutdown', ...this.buildIdArg() ]

    return this.runCommand(this.getRunnerPath(), args)
  }

  hasCorrectlyExited () {
    return this.app.exitCode === 0
  }

  kill () {
    if (!this.app || this.app.exitCode !== null) return

    process.kill(this.app.pid)

    this.app = null
  }

  // ---------------------------------------------------------------------------

  getId () {
    return 'test-' + this.server.internalServerNumber
  }

  private getRunnerPath () {
    return join(root(), 'apps', 'peertube-runner', 'dist', 'peertube-runner.js')
  }

  private buildIdArg () {
    return [ '--id', this.getId() ]
  }

  private runCommand (path: string, args: string[]) {
    return execaNode(path, args, { env: { ...process.env, NODE_OPTIONS: '' } })
  }
}
