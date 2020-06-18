import { join } from 'path'
import { CONFIG } from '../initializers/config'
import * as srt2vtt from 'srt-to-vtt'
import { createReadStream, createWriteStream, move, remove } from 'fs-extra'
import { MVideoCaptionFormattable } from '@server/types/models'

async function moveAndProcessCaptionFile (physicalFile: { filename: string, path: string }, videoCaption: MVideoCaptionFormattable) {
  const videoCaptionsDir = CONFIG.STORAGE.CAPTIONS_DIR
  const destination = join(videoCaptionsDir, videoCaption.getCaptionName())

  // Convert this srt file to vtt
  if (physicalFile.path.endsWith('.srt')) {
    await convertSrtToVtt(physicalFile.path, destination)
    await remove(physicalFile.path)
  } else if (physicalFile.path !== destination) { // Just move the vtt file
    await move(physicalFile.path, destination, { overwrite: true })
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
