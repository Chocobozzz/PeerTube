import { createReadStream, createWriteStream } from 'fs'
import { move, remove } from 'fs-extra/esm'
import { Transform } from 'stream'
import { MVideoCaption } from '@server/types/models/index.js'
import { pipelinePromise } from './core-utils.js'

async function moveAndProcessCaptionFile (physicalFile: { filename?: string, path: string }, videoCaption: MVideoCaption) {
  const destination = videoCaption.getFSPath()

  // Convert this srt file to vtt
  if (physicalFile.path.endsWith('.srt')) {
    await convertSrtToVtt(physicalFile.path, destination)
    await remove(physicalFile.path)
  } else if (physicalFile.path !== destination) { // Just move the vtt file
    await move(physicalFile.path, destination, { overwrite: true })
  }

  // This is important in case if there is another attempt in the retry process
  if (physicalFile.filename) physicalFile.filename = videoCaption.filename
  physicalFile.path = destination
}

// ---------------------------------------------------------------------------

export {
  moveAndProcessCaptionFile
}

// ---------------------------------------------------------------------------

async function convertSrtToVtt (source: string, destination: string) {
  const fixVTT = new Transform({
    transform: (chunk, _encoding, cb) => {
      let block: string = chunk.toString()

      block = block.replace(/(\d\d:\d\d:\d\d)(\s)/g, '$1.000$2')
                   .replace(/(\d\d:\d\d:\d\d),(\d)(\s)/g, '$1.00$2$3')
                   .replace(/(\d\d:\d\d:\d\d),(\d\d)(\s)/g, '$1.0$2$3')

      return cb(undefined, block)
    }
  })

  const srt2vtt = await import('srt-to-vtt')

  return pipelinePromise(
    createReadStream(source),
    srt2vtt.default(),
    fixVTT,
    createWriteStream(destination)
  )
}
