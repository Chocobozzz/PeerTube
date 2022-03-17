import { PeertubePlayerManagerOptions } from '../../types'

export class WebTorrentOptionsBuilder {

  constructor (
    private options: PeertubePlayerManagerOptions,
    private autoPlayValue: any
  ) {

  }

  getPluginOptions () {
    const commonOptions = this.options.common
    const webtorrentOptions = this.options.webtorrent
    const p2pMediaLoaderOptions = this.options.p2pMediaLoader

    const autoplay = this.autoPlayValue === 'play'

    const webtorrent = {
      autoplay,

      playerRefusedP2P: commonOptions.p2pEnabled === false,
      videoDuration: commonOptions.videoDuration,
      playerElement: commonOptions.playerElement,

      videoFiles: webtorrentOptions.videoFiles.length !== 0
        ? webtorrentOptions.videoFiles
        // The WebTorrent plugin won't be able to play these files, but it will fallback to HTTP mode
        : p2pMediaLoaderOptions?.videoFiles || [],

      startTime: commonOptions.startTime
    }

    return { webtorrent }
  }
}
