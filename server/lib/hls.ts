import { VideoModel } from '../models/video/video'
import { basename, dirname, join } from 'path'
import { HLS_PLAYLIST_DIRECTORY, CONFIG } from '../initializers'
import { outputJSON, pathExists, readdir, readFile, remove, writeFile, move } from 'fs-extra'
import { getVideoFileSize } from '../helpers/ffmpeg-utils'
import { sha256 } from '../helpers/core-utils'
import { VideoStreamingPlaylistModel } from '../models/video/video-streaming-playlist'
import HLSDownloader from 'hlsdownloader'
import { logger } from '../helpers/logger'
import { parse } from 'url'

async function updateMasterHLSPlaylist (video: VideoModel) {
  const directory = join(HLS_PLAYLIST_DIRECTORY, video.uuid)
  const masterPlaylists: string[] = [ '#EXTM3U', '#EXT-X-VERSION:3' ]
  const masterPlaylistPath = join(directory, VideoStreamingPlaylistModel.getMasterHlsPlaylistFilename())

  for (const file of video.VideoFiles) {
    // If we did not generated a playlist for this resolution, skip
    const filePlaylistPath = join(directory, VideoStreamingPlaylistModel.getHlsPlaylistFilename(file.resolution))
    if (await pathExists(filePlaylistPath) === false) continue

    const videoFilePath = video.getVideoFilePath(file)

    const size = await getVideoFileSize(videoFilePath)

    const bandwidth = 'BANDWIDTH=' + video.getBandwidthBits(file)
    const resolution = `RESOLUTION=${size.width}x${size.height}`

    let line = `#EXT-X-STREAM-INF:${bandwidth},${resolution}`
    if (file.fps) line += ',FRAME-RATE=' + file.fps

    masterPlaylists.push(line)
    masterPlaylists.push(VideoStreamingPlaylistModel.getHlsPlaylistFilename(file.resolution))
  }

  await writeFile(masterPlaylistPath, masterPlaylists.join('\n') + '\n')
}

async function updateSha256Segments (video: VideoModel) {
  const directory = join(HLS_PLAYLIST_DIRECTORY, video.uuid)
  const files = await readdir(directory)
  const json: { [filename: string]: string} = {}

  for (const file of files) {
    if (file.endsWith('.ts') === false) continue

    const buffer = await readFile(join(directory, file))
    const filename = basename(file)

    json[filename] = sha256(buffer)
  }

  const outputPath = join(directory, VideoStreamingPlaylistModel.getHlsSha256SegmentsFilename())
  await outputJSON(outputPath, json)
}

function downloadPlaylistSegments (playlistUrl: string, destinationDir: string, timeout: number) {
  let timer

  logger.info('Importing HLS playlist %s', playlistUrl)

  const params = {
    playlistURL: playlistUrl,
    destination: CONFIG.STORAGE.TMP_DIR
  }
  const downloader = new HLSDownloader(params)

  const hlsDestinationDir = join(CONFIG.STORAGE.TMP_DIR, dirname(parse(playlistUrl).pathname))

  return new Promise<string>(async (res, rej) => {
    downloader.startDownload(err => {
      clearTimeout(timer)

      if (err) {
        deleteTmpDirectory(hlsDestinationDir)

        return rej(err)
      }

      move(hlsDestinationDir, destinationDir, { overwrite: true })
        .then(() => res())
        .catch(err => {
          deleteTmpDirectory(hlsDestinationDir)

          return rej(err)
        })
    })

    timer = setTimeout(() => {
      deleteTmpDirectory(hlsDestinationDir)

      return rej(new Error('HLS download timeout.'))
    }, timeout)

    function deleteTmpDirectory (directory: string) {
      remove(directory)
        .catch(err => logger.error('Cannot delete path on HLS download error.', { err }))
    }
  })
}

// ---------------------------------------------------------------------------

export {
  updateMasterHLSPlaylist,
  updateSha256Segments,
  downloadPlaylistSegments
}

// ---------------------------------------------------------------------------
