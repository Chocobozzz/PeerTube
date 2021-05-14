import videojs from 'video.js'
import { PlayerNetworkInfo as EventPlayerNetworkInfo } from '../peertube-videojs-typings'
import { bytes, secondsToTime } from '../utils'

interface StatsCardOptions extends videojs.ComponentOptions {
  videoUUID: string
  videoIsLive: boolean
  mode: 'webtorrent' | 'p2p-media-loader'
}

interface PlayerNetworkInfo {
  downloadSpeed?: string
  uploadSpeed?: string
  totalDownloaded?: string
  totalUploaded?: string
  numPeers?: number
  averageBandwidth?: string

  downloadedFromServer?: string
  downloadedFromPeers?: string
}

const Component = videojs.getComponent('Component')
class StatsCard extends Component {
  options_: StatsCardOptions

  container: HTMLDivElement

  list: HTMLDivElement
  closeButton: HTMLElement

  updateInterval: any

  mode: 'webtorrent' | 'p2p-media-loader'

  metadataStore: any = {}

  intervalMs = 300
  playerNetworkInfo: PlayerNetworkInfo = {}

  constructor (player: videojs.Player, options: StatsCardOptions) {
    super(player, options)
  }

  createEl () {
    const container = super.createEl('div', {
      className: 'vjs-stats-content',
      innerHTML: this.getMainTemplate()
    }) as HTMLDivElement
    this.container = container
    this.container.style.display = 'none'

    this.closeButton = this.container.getElementsByClassName('vjs-stats-close')[0] as HTMLElement
    this.closeButton.onclick = () => this.hide()

    this.list = this.container.getElementsByClassName('vjs-stats-list')[0] as HTMLDivElement

    this.player_.on('p2pInfo', (event: any, data: EventPlayerNetworkInfo) => {
      if (!data) return // HTTP fallback

      this.mode = data.source

      const p2pStats = data.p2p
      const httpStats = data.http

      this.playerNetworkInfo.downloadSpeed = bytes(p2pStats.downloadSpeed + httpStats.downloadSpeed).join(' ')
      this.playerNetworkInfo.uploadSpeed = bytes(p2pStats.uploadSpeed + httpStats.uploadSpeed).join(' ')
      this.playerNetworkInfo.totalDownloaded = bytes(p2pStats.downloaded + httpStats.downloaded).join(' ')
      this.playerNetworkInfo.totalUploaded = bytes(p2pStats.uploaded + httpStats.uploaded).join(' ')
      this.playerNetworkInfo.numPeers = p2pStats.numPeers
      this.playerNetworkInfo.averageBandwidth = bytes(data.bandwidthEstimate).join(' ') + '/s'

      if (data.source === 'p2p-media-loader') {
        this.playerNetworkInfo.downloadedFromServer = bytes(httpStats.downloaded).join(' ')
        this.playerNetworkInfo.downloadedFromPeers = bytes(p2pStats.downloaded).join(' ')
      }
    })

    return container
  }

  toggle () {
    this.updateInterval
      ? this.hide()
      : this.show()
  }

  show () {
    this.container.style.display = 'block'
    this.updateInterval = setInterval(async () => {
      try {
        const options = this.mode === 'p2p-media-loader'
          ? await this.buildHLSOptions()
          : await this.buildWebTorrentOptions() // Default

        this.list.innerHTML = this.getListTemplate(options)
      } catch (err) {
        console.error('Cannot update stats.', err)
        clearInterval(this.updateInterval)
      }
    }, this.intervalMs)
  }

  hide () {
    clearInterval(this.updateInterval)
    this.container.style.display = 'none'
  }

  private async buildHLSOptions () {
    const p2pMediaLoader = this.player_.p2pMediaLoader()
    const level = p2pMediaLoader.getCurrentLevel()

    const codecs = level?.videoCodec || level?.audioCodec
      ? `${level?.videoCodec || ''} / ${level?.audioCodec || ''}`
      : undefined

    const resolution = `${level?.height}p${level?.attrs['FRAME-RATE'] || ''}`
    const buffer = this.timeRangesToString(this.player().buffered())

    let progress: number
    let latency: string

    if (this.options_.videoIsLive) {
      latency = secondsToTime(p2pMediaLoader.getLiveLatency())
    } else {
      progress = this.player().bufferedPercent()
    }

    return {
      playerNetworkInfo: this.playerNetworkInfo,
      resolution,
      codecs,
      buffer,
      latency,
      progress
    }
  }

  private async buildWebTorrentOptions () {
    const videoFile = this.player_.webtorrent().getCurrentVideoFile()

    if (!this.metadataStore[videoFile.fileUrl]) {
      this.metadataStore[videoFile.fileUrl] = await fetch(videoFile.metadataUrl).then(res => res.json())
    }

    const metadata = this.metadataStore[videoFile.fileUrl]

    let colorSpace = 'unknown'
    let codecs = 'unknown'

    if (metadata?.streams[0]) {
      const stream = metadata.streams[0]

      colorSpace = stream['color_space'] !== 'unknown'
        ? stream['color_space']
        : 'bt709'

      codecs = stream['codec_name'] || 'avc1'
    }

    const resolution = videoFile?.resolution.label + videoFile?.fps
    const buffer = this.timeRangesToString(this.player().buffered())
    const progress = this.player_.webtorrent().getTorrent()?.progress

    return {
      playerNetworkInfo: this.playerNetworkInfo,
      progress,
      colorSpace,
      codecs,
      resolution,
      buffer
    }
  }

  private getListTemplate (options: {
    playerNetworkInfo: PlayerNetworkInfo
    progress: number
    codecs: string
    resolution: string
    buffer: string

    latency?: string
    colorSpace?: string
  }) {
    const { playerNetworkInfo, progress, colorSpace, codecs, resolution, buffer, latency } = options
    const player = this.player()

    const videoQuality: VideoPlaybackQuality = player.getVideoPlaybackQuality()
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
    const pr = (window.devicePixelRatio || 1).toFixed(2)
    const frames = `${vw}x${vh}*${pr} / ${videoQuality.droppedVideoFrames} dropped of ${videoQuality.totalVideoFrames}`

    const duration = player.duration()

    let volume = `${Math.round(player.volume() * 100)}`
    if (player.muted()) volume += ' (muted)'

    const networkActivity = playerNetworkInfo.downloadSpeed
      ? `${playerNetworkInfo.downloadSpeed} &dArr; / ${playerNetworkInfo.uploadSpeed} &uArr;`
      : undefined

    const totalTransferred = playerNetworkInfo.totalDownloaded
      ? `${playerNetworkInfo.totalDownloaded} &dArr; / ${playerNetworkInfo.totalUploaded} &uArr;`
      : undefined
    const downloadBreakdown = playerNetworkInfo.downloadedFromServer
      ? `${playerNetworkInfo.downloadedFromServer} from server · ${playerNetworkInfo.downloadedFromPeers} from peers`
      : undefined

    const bufferProgress = progress !== undefined
      ? `${(progress * 100).toFixed(1)}% (${(progress * duration).toFixed(1)}s)`
      : undefined

    return `
      ${this.buildElement(player.localize('Player mode'), this.mode || 'HTTP')}

      ${this.buildElement(player.localize('Video UUID'), this.options_.videoUUID)}

      ${this.buildElement(player.localize('Viewport / Frames'), frames)}

      ${this.buildElement(player.localize('Resolution'), resolution)}

      ${this.buildElement(player.localize('Volume'), volume)}

      ${this.buildElement(player.localize('Codecs'), codecs)}
      ${this.buildElement(player.localize('Color'), colorSpace)}

      ${this.buildElement(player.localize('Connection Speed'), playerNetworkInfo.averageBandwidth)}

      ${this.buildElement(player.localize('Network Activity'), networkActivity)}
      ${this.buildElement(player.localize('Total Transfered'), totalTransferred)}
      ${this.buildElement(player.localize('Download Breakdown'), downloadBreakdown)}

      ${this.buildElement(player.localize('Buffer Progress'), bufferProgress)}
      ${this.buildElement(player.localize('Buffer State'), buffer)}

      ${this.buildElement(player.localize('Live Latency'), latency)}
    `
  }

  private getMainTemplate () {
    return `
      <button class="vjs-stats-close" tabindex=0 aria-label="Close stats" title="Close stats">[x]</button>
      <div class="vjs-stats-list"></div>
    `
  }

  private buildElement (label: string, value?: string) {
    if (!value) return ''

    return `<div><div>${label}</div><span>${value}</span></div>`
  }

  private timeRangesToString (r: videojs.TimeRange) {
    let result = ''

    for (let i = 0; i < r.length; i++) {
      const start = Math.floor(r.start(i))
      const end = Math.floor(r.end(i))

      result += `[${secondsToTime(start)}, ${secondsToTime(end)}] `
    }

    return result
  }
}

videojs.registerComponent('StatsCard', StatsCard)

export {
  StatsCard,
  StatsCardOptions
}
