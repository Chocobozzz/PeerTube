import videojs from 'video.js'
import { logger } from '@root-helpers/logger'
import { secondsToTime } from '@peertube/peertube-core-utils'
import { PlayerNetworkInfo as EventPlayerNetworkInfo } from '../../types'
import { bytes } from '../common'

interface StatsCardOptions extends videojs.ComponentOptions {
  videoUUID: string
  videoIsLive: boolean
  mode: 'web-video' | 'p2p-media-loader'
  p2pEnabled: boolean
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

interface InfoElement {
  root: HTMLElement
  value: HTMLElement
}

const Component = videojs.getComponent('Component')
class StatsCard extends Component {
  options_: StatsCardOptions

  updateInterval: any

  mode: 'web-video' | 'p2p-media-loader'

  metadataStore: any = {}

  intervalMs = 300
  playerNetworkInfo: PlayerNetworkInfo = {}

  private containerEl: HTMLDivElement
  private infoListEl: HTMLDivElement

  private playerMode: InfoElement
  private p2p: InfoElement
  private uuid: InfoElement
  private viewport: InfoElement
  private resolution: InfoElement
  private volume: InfoElement
  private codecs: InfoElement
  private color: InfoElement
  private connection: InfoElement

  private network: InfoElement
  private transferred: InfoElement
  private download: InfoElement

  private bufferProgress: InfoElement
  private bufferState: InfoElement

  private liveLatency: InfoElement

  private onNetworkInfoHandler: (_event: any, data: EventPlayerNetworkInfo) => void

  createEl () {
    this.containerEl = videojs.dom.createEl('div', {
      className: 'vjs-stats-content'
    }) as HTMLDivElement
    this.containerEl.style.display = 'none'

    this.infoListEl = videojs.dom.createEl('div', {
      className: 'vjs-stats-list'
    }) as HTMLDivElement

    const closeButton = videojs.dom.createEl('button', {
      className: 'vjs-stats-close',
      tabindex: '0',
      title: 'Close stats',
      innerText: '[x]'
    }, { 'aria-label': 'Close stats' }) as HTMLElement
    closeButton.onclick = () => this.hide()

    this.containerEl.appendChild(closeButton)
    this.containerEl.appendChild(this.infoListEl)

    this.populateInfoBlocks()

    this.onNetworkInfoHandler = (_event, data) => {
      this.mode = data.source

      const p2pStats = data.p2p
      const httpStats = data.http

      this.playerNetworkInfo.downloadSpeed = bytes((p2pStats?.downloadSpeed || 0) + (httpStats.downloadSpeed || 0)).join(' ')
      this.playerNetworkInfo.uploadSpeed = bytes(p2pStats?.uploadSpeed || 0).join(' ')
      this.playerNetworkInfo.totalDownloaded = bytes((p2pStats?.downloaded || 0) + httpStats.downloaded).join(' ')
      this.playerNetworkInfo.totalUploaded = bytes(p2pStats?.uploaded || 0).join(' ')
      this.playerNetworkInfo.numPeers = p2pStats?.peersWithWebSeed

      if (data.source === 'p2p-media-loader') {
        this.playerNetworkInfo.averageBandwidth = bytes(data.bandwidthEstimate).join(' ') + '/s'
        this.playerNetworkInfo.downloadedFromServer = bytes(httpStats.downloaded).join(' ')
        this.playerNetworkInfo.downloadedFromPeers = bytes(p2pStats?.downloaded || 0).join(' ')
      }
    }

    this.player().on('network-info', this.onNetworkInfoHandler)

    return this.containerEl
  }

  dispose () {
    if (this.updateInterval) clearInterval(this.updateInterval)

    this.player().off('network-info', this.onNetworkInfoHandler)

    super.dispose()
  }

  toggle () {
    if (this.updateInterval) this.hide()
    else this.show()
  }

  show () {
    this.containerEl.style.display = 'block'

    this.updateInterval = setInterval(async () => {
      try {
        const options = this.mode === 'p2p-media-loader'
          ? this.buildHLSOptions()
          : await this.buildWebVideoOptions() // Default

        this.populateInfoValues(options)
      } catch (err) {
        logger.error('Cannot update stats.', err)
        clearInterval(this.updateInterval)
      }
    }, this.intervalMs)
  }

  hide () {
    clearInterval(this.updateInterval)
    this.containerEl.style.display = 'none'
  }

  private buildHLSOptions () {
    const p2pMediaLoader = this.player_.p2pMediaLoader()
    const level = p2pMediaLoader.getCurrentLevel()

    const codecs = level?.videoCodec || level?.audioCodec
      ? `${level?.videoCodec || ''} / ${level?.audioCodec || ''}`
      : undefined

    const resolution = level?.height
      ? `${level.height}p${level?.attrs['FRAME-RATE'] || ''}`
      : undefined

    const buffer = this.timeRangesToString(this.player().buffered())

    let progress: number
    let latency: string
    let latencyFromEdge: string

    if (this.options_.videoIsLive) {
      latency = secondsToTime(p2pMediaLoader.getLiveLatency())
      latencyFromEdge = secondsToTime(p2pMediaLoader.getLiveLatencyFromEdge())
    } else {
      progress = this.player().bufferedPercent()
    }

    return {
      playerNetworkInfo: this.playerNetworkInfo,
      resolution,
      codecs,
      buffer,
      latency,
      latencyFromEdge,
      progress
    }
  }

  private async buildWebVideoOptions () {
    const videoFile = this.player_.webVideo().getCurrentVideoFile()

    if (!this.metadataStore[videoFile.fileUrl]) {
      this.metadataStore[videoFile.fileUrl] = await fetch(videoFile.metadataUrl).then(res => res.json())
    }

    const metadata = this.metadataStore[videoFile.fileUrl]

    let colorSpace = 'unknown'
    let codecs = 'unknown'

    if (metadata?.streams?.[0]) {
      const stream = metadata.streams[0]

      colorSpace = stream['color_space'] !== 'unknown'
        ? stream['color_space']
        : 'bt709'

      codecs = stream['codec_name'] || 'avc1'
    }

    const resolution = videoFile?.resolution.label + videoFile?.fps
    const buffer = this.timeRangesToString(this.player_.buffered())
    const progress = this.player_.bufferedPercent()

    return {
      playerNetworkInfo: this.playerNetworkInfo,
      progress,
      colorSpace,
      codecs,
      resolution,
      buffer
    }
  }

  private populateInfoBlocks () {
    this.playerMode = this.buildInfoRow(this.player().localize('Player mode'))
    this.p2p = this.buildInfoRow(this.player().localize('P2P'))
    this.uuid = this.buildInfoRow(this.player().localize('Video UUID'))
    this.viewport = this.buildInfoRow(this.player().localize('Viewport / Frames'))
    this.resolution = this.buildInfoRow(this.player().localize('Resolution'))
    this.volume = this.buildInfoRow(this.player().localize('Volume'))
    this.codecs = this.buildInfoRow(this.player().localize('Codecs'))
    this.color = this.buildInfoRow(this.player().localize('Color'))
    this.connection = this.buildInfoRow(this.player().localize('Connection Speed'))

    this.network = this.buildInfoRow(this.player().localize('Network Activity'))
    this.transferred = this.buildInfoRow(this.player().localize('Total Transfered'))
    this.download = this.buildInfoRow(this.player().localize('Download Breakdown'))

    this.bufferProgress = this.buildInfoRow(this.player().localize('Buffer Progress'))
    this.bufferState = this.buildInfoRow(this.player().localize('Buffer State'))

    this.liveLatency = this.buildInfoRow(this.player().localize('Live Latency'))

    this.infoListEl.appendChild(this.playerMode.root)
    this.infoListEl.appendChild(this.p2p.root)
    this.infoListEl.appendChild(this.uuid.root)
    this.infoListEl.appendChild(this.viewport.root)
    this.infoListEl.appendChild(this.resolution.root)
    this.infoListEl.appendChild(this.volume.root)
    this.infoListEl.appendChild(this.codecs.root)
    this.infoListEl.appendChild(this.color.root)
    this.infoListEl.appendChild(this.connection.root)
    this.infoListEl.appendChild(this.network.root)
    this.infoListEl.appendChild(this.transferred.root)
    this.infoListEl.appendChild(this.download.root)
    this.infoListEl.appendChild(this.bufferProgress.root)
    this.infoListEl.appendChild(this.bufferState.root)
    this.infoListEl.appendChild(this.liveLatency.root)
  }

  private populateInfoValues (options: {
    playerNetworkInfo: PlayerNetworkInfo
    progress: number
    codecs: string
    resolution: string
    buffer: string

    latency?: string
    latencyFromEdge?: string
    colorSpace?: string
  }) {
    const { playerNetworkInfo, progress, colorSpace, codecs, resolution, buffer, latency, latencyFromEdge } = options
    const { downloadedFromServer, downloadedFromPeers } = playerNetworkInfo

    const player = this.player()

    const videoQuality: VideoPlaybackQuality = player.getVideoPlaybackQuality()
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
    const pr = (window.devicePixelRatio || 1).toFixed(2)
    const vp = `${vw}x${vh}*${pr}`
    const { droppedVideoFrames, totalVideoFrames } = videoQuality
    const frames = player.localize('{1} / {2} dropped of {3}', [ vp, droppedVideoFrames + '', totalVideoFrames + '' ])
    const duration = player.duration()

    let volume = `${Math.round(player.volume() * 100)}`
    if (player.muted()) volume += player.localize(' (muted)')

    const networkActivity = playerNetworkInfo.downloadSpeed
      ? `${playerNetworkInfo.downloadSpeed} \u21D3 / ${playerNetworkInfo.uploadSpeed} \u21D1`
      : undefined

    let totalTransferred = playerNetworkInfo.totalDownloaded
      ? `${playerNetworkInfo.totalDownloaded} \u21D3`
      : ''

    if (playerNetworkInfo.totalUploaded) {
      totalTransferred += `/ ${playerNetworkInfo.totalUploaded} \u21D1`
    }

    const downloadBreakdown = playerNetworkInfo.downloadedFromServer
      ? player.localize('{1} from servers · {2} from peers', [ downloadedFromServer, downloadedFromPeers ])
      : undefined

    const bufferProgress = progress !== undefined
      ? `${(progress * 100).toFixed(1)}% (${(progress * duration).toFixed(1)}s)`
      : undefined

    const p2pEnabled = this.options_.p2pEnabled && this.mode === 'p2p-media-loader'

    this.setInfoValue(this.playerMode, this.mode)
    this.setInfoValue(this.p2p, player.localize(p2pEnabled ? 'enabled' : 'disabled'))
    this.setInfoValue(this.uuid, this.options_.videoUUID)

    this.setInfoValue(this.viewport, frames)
    this.setInfoValue(this.resolution, resolution)
    this.setInfoValue(this.volume, volume)
    this.setInfoValue(this.codecs, codecs)
    this.setInfoValue(this.color, colorSpace)
    this.setInfoValue(this.transferred, totalTransferred)
    this.setInfoValue(this.connection, playerNetworkInfo.averageBandwidth)

    this.setInfoValue(this.network, networkActivity)
    this.setInfoValue(this.download, downloadBreakdown)

    this.setInfoValue(this.bufferProgress, bufferProgress)
    this.setInfoValue(this.bufferState, buffer)

    if (latency && latencyFromEdge) {
      this.setInfoValue(this.liveLatency, player.localize('{1} (from edge: {2})', [ latency, latencyFromEdge ]))
    }
  }

  private setInfoValue (el: InfoElement, value: string) {
    if (!value) {
      el.root.style.display = 'none'
      return
    }

    el.root.style.display = 'block'

    if (el.value.innerText === value) return
    el.value.innerText = value
  }

  private buildInfoRow (labelText: string) {
    const root = videojs.dom.createEl('div') as HTMLElement
    root.style.display = 'none'

    const label = videojs.dom.createEl('div', { innerText: labelText }) as HTMLElement
    const value = videojs.dom.createEl('span') as HTMLElement

    root.appendChild(label)
    root.appendChild(value)

    return { root, value }
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
