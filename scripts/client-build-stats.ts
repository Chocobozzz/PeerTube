import { root } from '@peertube/peertube-node-utils'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'

async function run () {
  const result = {
    app: await buildResult(join(root(), 'client', 'dist', 'en-US')),
    embed: await buildResult(join(root(), 'client', 'dist', 'standalone', 'videos'))
  }

  console.log(JSON.stringify(result))
}

run()
  .catch(err => console.error(err))

async function buildResult (path: string, root = path) {
  const distFiles = await readdir(path)

  let files: { name: string, size: number }[] = []

  for (const file of distFiles) {
    const filePath = join(path, file)

    const statsResult = await stat(filePath)
    if (statsResult.isDirectory()) {
      files = files.concat(await buildResult(filePath, root))
    }

    files.push({
      name: filePath.replace(new RegExp(`^${root}/`), ''),
      size: statsResult.size
    })
  }

  return files
}
