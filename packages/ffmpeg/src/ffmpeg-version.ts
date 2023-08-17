import { exec } from 'child_process'
import ffmpeg from 'fluent-ffmpeg'

export function getFFmpegVersion () {
  return new Promise<string>((res, rej) => {
    (ffmpeg() as any)._getFfmpegPath((err, ffmpegPath) => {
      if (err) return rej(err)
      if (!ffmpegPath) return rej(new Error('Could not find ffmpeg path'))

      return exec(`${ffmpegPath} -version`, (err, stdout) => {
        if (err) return rej(err)

        const parsed = stdout.match(/ffmpeg version .?(\d+\.\d+(\.\d+)?)/)
        if (!parsed?.[1]) return rej(new Error(`Could not find ffmpeg version in ${stdout}`))

        // Fix ffmpeg version that does not include patch version (4.4 for example)
        let version = parsed[1]
        if (version.match(/^\d+\.\d+$/)) {
          version += '.0'
        }
      })
    })
  })
}
