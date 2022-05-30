import { createReadStream, createWriteStream, move, remove } from 'fs-extra'
import { join } from 'path'
import * as srt2vtt from 'srt-to-vtt'
import { MVideoCaption } from '@server/types/models'
import { CONFIG } from '../initializers/config'
import { pipelinePromise } from './core-utils'
import { Transform } from 'stream'

async function moveAndProcessCaptionFile (physicalFile: { filename: string, path: string }, videoCaption: MVideoCaption) {
  const videoCaptionsDir = CONFIG.STORAGE.CAPTIONS_DIR
  const destination = join(videoCaptionsDir, videoCaption.filename)

  // Convert this srt file to vtt
  if (physicalFile.path.endsWith('.srt')) {
    await convertSrtToVtt(physicalFile.path, destination)
    await remove(physicalFile.path)
  } else if (physicalFile.path !== destination) { // Just move the vtt file
    await move(physicalFile.path, destination, { overwrite: true })
  }

  // This is important in case if there is another attempt in the retry process
  physicalFile.filename = videoCaption.filename
  physicalFile.path = destination
}

// ---------------------------------------------------------------------------

export {
  moveAndProcessCaptionFile
}

// ---------------------------------------------------------------------------

function convertSrtToVtt (source: string, destination: string) {
  const fixVTT = new Transform({
    transform: (chunk, _encoding, cb) => {
      let block: string = chunk.toString()

      block = block.replace(/(\d\d:\d\d:\d\d)(\s)/g, '$1.000$2')
                   .replace(/(\d\d:\d\d:\d\d),(\d)(\s)/g, '$1.00$2$3')
                   .replace(/(\d\d:\d\d:\d\d),(\d\d)(\s)/g, '$1.0$2$3')

      return cb(undefined, block)
    }
  })

  return pipelinePromise(
    createReadStream(source),
    srt2vtt(),
    fixVTT,
    createWriteStream(destination)
  )
}
