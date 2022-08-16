import videojs from 'video.js'
import { logger } from '@root-helpers/logger'
import { secondsToTime } from '@shared/core-utils'
import { PlayerNetworkInfo as EventPlayerNetworkInfo } from '../../types'
import { bytes } from '../common'

interface StatsCardOptions extends videojs.ComponentOptions {
  videoUUID: string
  videoIsLive: boolean
  mode: 'webtorrent' | 'p2p-media-loader'
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

  mode: 'webtorrent' | 'p2p-media-loader'

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

    this.player_.on('p2pInfo', (event: any, data: EventPlayerNetworkInfo) => {
      if (!data) return // HTTP fallback

      this.mode = data.source

      const p2pStats = data.p2p
      const httpStats = data.http

      this.playerNetworkInfo.downloadSpeed = bytes(p2pStats.downloadSpeed + httpStats.downloadSpeed).join(' ')
      this.playerNetworkInfo.uploadSpeed = bytes(p2pStats.uploadSpeed).join(' ')
      this.playerNetworkInfo.totalDownloaded = bytes(p2pStats.downloaded + httpStats.downloaded).join(' ')
      this.playerNetworkInfo.totalUploaded = bytes(p2pStats.uploaded).join(' ')
      this.playerNetworkInfo.numPeers = p2pStats.numPeers
      this.playerNetworkInfo.averageBandwidth = bytes(data.bandwidthEstimate).join(' ') + '/s'

      if (data.source === 'p2p-media-loader') {
        this.playerNetworkInfo.downloadedFromServer = bytes(httpStats.downloaded).join(' ')
        this.playerNetworkInfo.downloadedFromPeers = bytes(p2pStats.downloaded).join(' ')
      }
    })

    return this.containerEl
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
          : await this.buildWebTorrentOptions() // Default

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
      ? `${level?.height}p${level?.attrs['FRAME-RATE'] || ''}`
      : undefined

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
      ? `${playerNetworkInfo.downloadedFromServer} from servers · ${playerNetworkInfo.downloadedFromPeers} from peers`
      : undefined

    const bufferProgress = progress !== undefined
      ? `${(progress * 100).toFixed(1)}% (${(progress * duration).toFixed(1)}s)`
      : undefined

    this.setInfoValue(this.playerMode, this.mode || 'HTTP')
    this.setInfoValue(this.p2p, player.localize(this.options_.p2pEnabled ? 'enabled' : 'disabled'))
    this.setInfoValue(this.uuid, this.options_.videoUUID)

    this.setInfoValue(this.viewport, frames)
    this.setInfoValue(this.resolution, resolution)
    this.setInfoValue(this.volume, volume)
    this.setInfoValue(this.codecs, codecs)
    this.setInfoValue(this.color, colorSpace)
    this.setInfoValue(this.connection, playerNetworkInfo.averageBandwidth)

    this.setInfoValue(this.network, networkActivity)
    this.setInfoValue(this.transferred, totalTransferred)
    this.setInfoValue(this.download, downloadBreakdown)

    this.setInfoValue(this.bufferProgress, bufferProgress)
    this.setInfoValue(this.bufferState, buffer)

    this.setInfoValue(this.liveLatency, latency)
  }

  private setInfoValue (el: InfoElement, value: string) {
    if (!value) {
      el.root.style.display = 'none'
      return
    }

    el.root.style.display = 'block'

    if (el.value.innerHTML === value) return
    el.value.innerHTML = value
  }

  private buildInfoRow (labelText: string, valueHTML?: string) {
    const root = videojs.dom.createEl('div') as HTMLElement
    root.style.display = 'none'

    const label = videojs.dom.createEl('div', { innerText: labelText }) as HTMLElement
    const value = videojs.dom.createEl('span', { innerHTML: valueHTML }) as HTMLElement

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
