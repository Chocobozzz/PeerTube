// Thanks: https://github.com/przemyslawpluta/node-youtube-dl/blob/master/lib/downloader.js
// We rewrote it to avoid sync calls

import { AbstractScheduler } from './abstract-scheduler'
import { SCHEDULER_INTERVALS_MS } from '../../initializers'
import { logger } from '../../helpers/logger'
import * as request from 'request'
import { createWriteStream, writeFile } from 'fs'
import { join } from 'path'
import { mkdirpPromise, root } from '../../helpers/core-utils'

export class YoutubeDlUpdateScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.youtubeDLUpdate

  private constructor () {
    super()
  }

  async execute () {
    logger.info('Updating youtubeDL binary.')

    const binDirectory = join(root(), 'node_modules', 'youtube-dl', 'bin')
    const bin = join(binDirectory, 'youtube-dl')
    const detailsPath = join(binDirectory, 'details')
    const url = 'https://yt-dl.org/downloads/latest/youtube-dl'

    await mkdirpPromise(binDirectory)

    return new Promise(res => {
      request.get(url, { followRedirect: false }, (err, result) => {
        if (err) {
          logger.error('Cannot update youtube-dl.', { err })
          return res()
        }

        if (result.statusCode !== 302) {
          logger.error('youtube-dl update error: did not get redirect for the latest version link. Status %d', result.statusCode)
          return res()
        }

        const url = result.headers.location
        const downloadFile = request.get(url)
        const newVersion = /yt-dl\.org\/downloads\/(\d{4}\.\d\d\.\d\d(\.\d)?)\/youtube-dl/.exec(url)[ 1 ]

        downloadFile.on('response', result => {
          if (result.statusCode !== 200) {
            logger.error('Cannot update youtube-dl: new version response is not 200, it\'s %d.', result.statusCode)
            return res()
          }

          downloadFile.pipe(createWriteStream(bin, { mode: 493 }))
        })

        downloadFile.on('error', err => {
          logger.error('youtube-dl update error.', { err })
          return res()
        })

        downloadFile.on('end', () => {
          const details = JSON.stringify({ version: newVersion, path: bin, exec: 'youtube-dl' })
          writeFile(detailsPath, details, { encoding: 'utf8' }, err => {
            if (err) {
              logger.error('youtube-dl update error: cannot write details.', { err })
              return res()
            }

            logger.info('youtube-dl updated to version %s.', newVersion)
            return res()
          })
        })
      })
    })
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
