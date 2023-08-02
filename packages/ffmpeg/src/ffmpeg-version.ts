import { exec } from 'child_process'
import ffmpeg from 'fluent-ffmpeg'

/**
 * @returns FFmpeg version string. Usually a semver string, but may vary when depending on installation method.
 */
export function getFFmpegVersion () {
  return new Promise<string>((res, rej) => {
    (ffmpeg() as any)._getFfmpegPath((err, ffmpegPath) => {
      if (err) return rej(err)
      if (!ffmpegPath) return rej(new Error('Could not find ffmpeg path'))

      return exec(`${ffmpegPath} -version`, (err, stdout) => {
        if (err) return rej(err)

        const parsed = stdout.match(/(?<=ffmpeg version )[a-zA-Z\d.-]+/)
        if (!parsed) return rej(new Error(`Could not find ffmpeg version in ${stdout}`))

        res(parsed[0])
      })
    })
  })
}
