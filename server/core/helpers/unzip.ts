import { createWriteStream } from 'fs'
import { ensureDir } from 'fs-extra/esm'
import { dirname, join } from 'path'
import { pipeline } from 'stream'
import * as yauzl from 'yauzl'
import { logger, loggerTagsFactory } from './logger.js'

const lTags = loggerTagsFactory('unzip')

export async function unzip (options: {
  source: string
  destination: string
  maxSize: number // in bytes
  maxFiles: number
}) {
  const { source, destination } = options

  await ensureDir(destination)

  logger.info(`Unzip ${source} to ${destination}`, lTags())

  return new Promise<void>((res, rej) => {
    yauzl.open(source, { lazyEntries: true }, (err, zipFile) => {
      if (err) return rej(err)

      zipFile.on('error', err => rej(err))

      let decompressedSize = 0
      let entries = 0

      zipFile.readEntry()

      zipFile.on('entry', async entry => {
        decompressedSize += entry.uncompressedSize
        entries++

        if (decompressedSize > options.maxSize) {
          zipFile.close()
          return rej(new Error(`Unzipped size exceeds ${options.maxSize} bytes`))
        }

        if (entries > options.maxFiles) {
          zipFile.close()
          return rej(new Error(`Unzipped files count exceeds ${options.maxFiles}`))
        }

        const entryPath = join(destination, entry.fileName)

        try {
          if (entry.fileName.endsWith('/')) {
            await ensureDir(entryPath)
            logger.debug(`Creating directory from zip ${entryPath}`, lTags())

            zipFile.readEntry()
            return
          }

          await ensureDir(dirname(entryPath))
        } catch (err) {
          return rej(err)
        }

        zipFile.openReadStream(entry, (readErr, readStream) => {
          if (readErr) return rej(readErr)

          logger.debug(`Creating file from zip ${entryPath}`, lTags())

          const writeStream = createWriteStream(entryPath)
          writeStream.on('close', () => zipFile.readEntry())

          pipeline(readStream, writeStream, pipelineErr => {
            if (pipelineErr) return rej(pipelineErr)
          })
        })
      })

      zipFile.on('end', () => res())
    })
  })
}
