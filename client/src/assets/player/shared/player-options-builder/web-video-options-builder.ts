import { PeerTubePlayerLoadOptions, WebVideoPluginOptions } from '../../types'

type ConstructorOptions = Pick<PeerTubePlayerLoadOptions, 'videoFileToken' | 'webVideo' | 'hls'>

export class WebVideoOptionsBuilder {

  constructor (private options: ConstructorOptions) {

  }

  getPluginOptions (): WebVideoPluginOptions {
    return {
      videoFileToken: this.options.videoFileToken,

      videoFiles: this.options.webVideo.videoFiles.length !== 0
        ? this.options.webVideo.videoFiles
        : this.options.hls?.videoFiles || []
    }
  }
}
