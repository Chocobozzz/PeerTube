import { exec } from 'child_process'
import { copy, ensureDir, readFile, remove } from 'fs-extra'
import { join } from 'path'
import { root } from '@server/helpers/core-utils'
import { HttpStatusCode } from '@shared/core-utils'
import { getFileSize } from '@uploadx/core'
import { isGithubCI, wait } from '../miscs'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class ServersCommand extends AbstractCommand {

  static flushTests (internalServerNumber: number) {
    return new Promise<void>((res, rej) => {
      const suffix = ` -- ${internalServerNumber}`

      return exec('npm run clean:server:test' + suffix, (err, _stdout, stderr) => {
        if (err || stderr) return rej(err || new Error(stderr))

        return res()
      })
    })
  }

  ping (options: OverrideCommandOptions = {}) {
    return this.getRequestBody({
      ...options,

      path: '/api/v1/ping',
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  async cleanupTests () {
    const p: Promise<any>[] = []

    if (isGithubCI()) {
      await ensureDir('artifacts')

      const origin = this.server.serversCommand.buildDirectory('logs/peertube.log')
      const destname = `peertube-${this.server.internalServerNumber}.log`
      console.log('Saving logs %s.', destname)

      await copy(origin, join('artifacts', destname))
    }

    if (this.server.parallel) {
      p.push(ServersCommand.flushTests(this.server.internalServerNumber))
    }

    if (this.server.customConfigFile) {
      p.push(remove(this.server.customConfigFile))
    }

    return p
  }

  async waitUntilLog (str: string, count = 1, strictCount = true) {
    const logfile = this.server.serversCommand.buildDirectory('logs/peertube.log')

    while (true) {
      const buf = await readFile(logfile)

      const matches = buf.toString().match(new RegExp(str, 'g'))
      if (matches && matches.length === count) return
      if (matches && strictCount === false && matches.length >= count) return

      await wait(1000)
    }
  }

  buildDirectory (directory: string) {
    return join(root(), 'test' + this.server.internalServerNumber, directory)
  }

  async getServerFileSize (subPath: string) {
    const path = this.server.serversCommand.buildDirectory(subPath)

    return getFileSize(path)
  }
}
