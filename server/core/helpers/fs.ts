import { move, remove } from 'fs-extra/esm'
import { rename } from 'fs/promises'
import { logger } from './logger.js'

export async function tryAtomicMove (src: string, destination: string) {
  try {
    await rename(src, destination)
  } catch (err) {
    if (err?.code !== 'EXDEV') throw err

    return move(src, destination, { overwrite: true })
  }
}

export function deleteFileAndCatch (path: string) {
  remove(path)
    .catch(err => logger.error('Cannot delete the file %s asynchronously.', path, { err }))
}
