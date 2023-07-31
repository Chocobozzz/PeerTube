import { stat } from 'fs/promises'

async function getFileSize (path: string) {
  const stats = await stat(path)

  return stats.size
}

export {
  getFileSize
}
