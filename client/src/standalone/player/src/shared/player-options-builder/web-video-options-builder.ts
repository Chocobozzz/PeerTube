import { VideoResolution } from '@peertube/peertube-models'
import { PeerTubePlayerLoadOptions, WebVideoPluginOptions } from '../../types'

type ConstructorOptions = Pick<PeerTubePlayerLoadOptions, 'videoFileToken' | 'webVideo' | 'hls'>

export class WebVideoOptionsBuilder {
  constructor (private options: ConstructorOptions) {
  }

  getPluginOptions (): WebVideoPluginOptions {
    const videoFileToken = this.options.videoFileToken

    const hlsFiles = this.options.hls?.videoFiles || []
    const webVideoFiles = this.options.webVideo.videoFiles || []

    // We have web video files, that aren't "audio only" files
    if (webVideoFiles.length !== 0 && webVideoFiles.some(f => f.resolution.id !== VideoResolution.H_NOVIDEO)) {
      return { videoFileToken, videoFiles: webVideoFiles }
    }

    // Not ideal because HLS files are fragmented, but better than nothing
    if (hlsFiles.length !== 0 && hlsFiles.some(f => f.resolution.id !== VideoResolution.H_NOVIDEO)) {
      return { videoFileToken, videoFiles: hlsFiles }
    }

    // Fallback to video files anyway
    return { videoFileToken, videoFiles: webVideoFiles }
  }
}
