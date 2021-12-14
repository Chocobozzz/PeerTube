import { registerTSPaths } from '../server/helpers/register-ts-paths'
registerTSPaths()

import { readdir, stat } from 'fs-extra'
import { join } from 'path'
import { root } from '@shared/core-utils'

async function run () {
  const result = {
    app: await buildResult(join(root(), 'client', 'dist', 'en-US')),
    embed: await buildResult(join(root(), 'client', 'dist', 'standalone', 'videos'))
  }

  console.log(JSON.stringify(result))
}

run()
  .catch(err => console.error(err))

async function buildResult (path: string) {
  const distFiles = await readdir(path)

  const files: { name: string, size: number }[] = []

  for (const file of distFiles) {
    const filePath = join(path, file)

    const statsResult = await stat(filePath)
    files.push({
      name: file,
      size: statsResult.size
    })
  }

  return files
}
