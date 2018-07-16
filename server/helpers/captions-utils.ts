import { renamePromise, unlinkPromise } from './core-utils'
import { join } from 'path'
import { CONFIG } from '../initializers'
import { VideoCaptionModel } from '../models/video/video-caption'
import * as srt2vtt from 'srt-to-vtt'
import { createReadStream, createWriteStream } from 'fs'

async function moveAndProcessCaptionFile (physicalFile: { filename: string, path: string }, videoCaption: VideoCaptionModel) {
  const videoCaptionsDir = CONFIG.STORAGE.CAPTIONS_DIR
  const destination = join(videoCaptionsDir, videoCaption.getCaptionName())

  // Convert this srt file to vtt
  if (physicalFile.path.endsWith('.srt')) {
    await convertSrtToVtt(physicalFile.path, destination)
    await unlinkPromise(physicalFile.path)
  } else { // Just move the vtt file
    await renamePromise(physicalFile.path, destination)
  }

  // This is important in case if there is another attempt in the retry process
  physicalFile.filename = videoCaption.getCaptionName()
  physicalFile.path = destination
}

// ---------------------------------------------------------------------------

export {
  moveAndProcessCaptionFile
}

// ---------------------------------------------------------------------------

function convertSrtToVtt (source: string, destination: string) {
  return new Promise((res, rej) => {
    const file = createReadStream(source)
    const converter = srt2vtt()
    const writer = createWriteStream(destination)

    for (const s of [ file, converter, writer ]) {
      s.on('error', err => rej(err))
    }

    return file.pipe(converter)
               .pipe(writer)
               .on('finish', () => res())
  })
}
