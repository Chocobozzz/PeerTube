import { move, remove } from 'fs-extra/esm'
import { readdir, rename } from 'fs/promises'
import { isAbsolute, relative, resolve, sep } from 'path'
import { createLogger } from './logger.js'

const logger = createLogger()

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

export function isFileInsideDirectory (path: string, directory: string) {
  const rel = relative(resolve(directory), resolve(path))

  return rel !== '' && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)
}

export async function readdirNonHidden (path: string) {
  const files = await readdir(path)

  return files.filter(file => !file.startsWith('.'))
}
