import { stat } from 'fs-extra'

async function mtimeSortFilesDesc (files: string[], basePath: string) {
  const promises = []
  const out: { file: string, mtime: number }[] = []

  for (const file of files) {
    const p = stat(basePath + '/' + file)
      .then(stats => {
        if (stats.isFile()) out.push({ file, mtime: stats.mtime.getTime() })
      })

    promises.push(p)
  }

  await Promise.all(promises)

  out.sort((a, b) => b.mtime - a.mtime)

  return out
}

export {
  mtimeSortFilesDesc
}
