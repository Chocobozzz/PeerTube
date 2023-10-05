import { move } from 'fs-extra/esm'
import { rename } from 'fs/promises'

export async function tryAtomicMove (src: string, destination: string) {
  try {
    await rename(src, destination)
  } catch (err) {
    if (err?.code !== 'EXDEV') throw err

    return move(src, destination, { overwrite: true })
  }
}
