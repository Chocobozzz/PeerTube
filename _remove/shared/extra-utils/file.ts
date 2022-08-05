import { stat } from 'fs-extra'

async function getFileSize (path: string) {
  const stats = await stat(path)

  return stats.size
}

export {
  getFileSize
}
