import ffmpeg from 'fluent-ffmpeg'
import { FFMPEG_NICE } from '@server/initializers/constants'
import { runCommand } from './ffmpeg-commons'

function convertWebPToJPG (path: string, destination: string): Promise<void> {
  const command = ffmpeg(path, { niceness: FFMPEG_NICE.THUMBNAIL })
    .output(destination)

  return runCommand({ command, silent: true })
}

function processGIF (
  path: string,
  destination: string,
  newSize: { width: number, height: number }
): Promise<void> {
  const command = ffmpeg(path, { niceness: FFMPEG_NICE.THUMBNAIL })
    .fps(20)
    .size(`${newSize.width}x${newSize.height}`)
    .output(destination)

  return runCommand({ command })
}

async function generateThumbnailFromVideo (fromPath: string, folder: string, imageName: string) {
  const pendingImageName = 'pending-' + imageName

  const options = {
    filename: pendingImageName,
    count: 1,
    folder
  }

  return new Promise<string>((res, rej) => {
    ffmpeg(fromPath, { niceness: FFMPEG_NICE.THUMBNAIL })
      .on('error', rej)
      .on('end', () => res(imageName))
      .thumbnail(options)
  })
}

export {
  convertWebPToJPG,
  processGIF,
  generateThumbnailFromVideo
}
