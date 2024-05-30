import { join, parse } from 'node:path'
import { createWriteStream } from 'node:fs'
import { lstat, unlink } from 'node:fs/promises'
import assert from 'node:assert'
import { $ } from 'execa'
import { makeFileRequest } from '@peertube/peertube-server-commands'

export const downloadFile = async (url: string, targetDirectory: string) => {
  const { base } = parse(url)
  const filePath = join(targetDirectory, base)

  const fileStream = createWriteStream(filePath)
  const stream = makeFileRequest(url).pipe(fileStream)

  return await new Promise((resolve: (filePath: string) => void, reject) => {
    stream.on('finish', () => resolve(filePath))
    stream.on('error', async e => {
      fileStream.close()
      await unlink(filePath)
      reject(e.message)
    })
  })
}

export const unzip = async (zipFilePath: string) => {
  assert(await lstat(zipFilePath).then(stats => stats.isFile()), `${zipFilePath} isn't a file.`)
  const { dir, name } = parse(zipFilePath)

  await $`unzip -o ${zipFilePath} -d ${dir}`

  return join(dir, name)
}
