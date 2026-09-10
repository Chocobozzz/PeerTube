import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { isGithubCI, root } from '@peertube/peertube-node-utils'
import { exec } from 'child_process'
import { copy, ensureDir, remove } from 'fs-extra/esm'
import { readFile, readdir } from 'fs/promises'
import { basename, join } from 'path'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

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

  flushTestsIfNeeded () {
    // Primary owns the database and redis, and primary will cleanup main test directory
    // Secondary doesn't have a config file to clean up
    if (this.server.isSecondaryServer()) return

    return ServersCommand.flushTests(this.server.internalServerNumber)
  }

  ping (options: OverrideCommandOptions = {}) {
    return this.getRequestBody({
      ...options,

      path: '/api/v1/ping',
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  cleanupTests () {
    const promises: Promise<any>[] = []

    const saveGithubLogsIfNeeded = async () => {
      if (!isGithubCI()) return

      await ensureDir('artifacts')

      const origin = this.buildDirectory(this.server.storage.logsDirectory + '/peertube.log')
      const destname = `peertube-${this.server.nodeAppInstance || this.server.internalServerNumber}.log`
      console.log('Saving logs %s.', destname)

      await copy(origin, join('artifacts', destname))
    }

    const saveDBIfNeeded = async () => {
      if (!isGithubCI()) return
      // Primary owns the database
      if (this.server.isSecondaryServer()) return

      await ensureDir('artifacts')
      const destname = join('artifacts', `peertube-${this.server.internalServerNumber}.sql`)
      console.log('Saving database %s.', destname)

      exec(`pg_dump peertube_test${this.server.internalServerNumber} > ${destname}`)
    }

    if (this.server.parallel) {
      const promise = saveGithubLogsIfNeeded()
        .then(() => saveDBIfNeeded())
        .then(() => this.flushTestsIfNeeded())

      promises.push(promise)
    }

    if (this.server.customConfigFile) {
      promises.push(remove(this.server.customConfigFile))
    }

    return promises
  }

  async waitUntilLog (str: string, count = 1, strictCount = true) {
    const logfile = this.buildDirectory(this.server.storage.logsDirectory + '/peertube.log')

    while (true) {
      const buf = await readFile(logfile)

      const matches = buf.toString().match(new RegExp(str, 'g'))
      if (matches?.length === count) return
      if (matches && strictCount === false && matches.length >= count) return

      await wait(1000)
    }
  }

  buildDirectory (directory: string) {
    return join(root(), 'test' + this.server.internalServerNumber, directory)
  }

  async countFiles (directory: string) {
    const files = await readdir(this.buildDirectory(directory))

    // Hidden files are metadata
    return files.filter(file => file.startsWith('.') === false).length
  }

  // ---------------------------------------------------------------------------

  buildWebVideoFilePath (fileUrl: string) {
    return this.buildDirectory(join('web-videos', basename(fileUrl)))
  }

  buildFragmentedFilePath (videoUUID: string, fileUrl: string) {
    return this.buildDirectory(join('streaming-playlists', 'hls', videoUUID, basename(fileUrl)))
  }

  // ---------------------------------------------------------------------------

  getLogContent () {
    return readFile(this.buildDirectory(this.server.storage.logsDirectory + '/peertube.log'))
  }
}
