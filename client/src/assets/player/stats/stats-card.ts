import videojs from 'video.js'
import { PlayerNetworkInfo } from '../peertube-videojs-typings'
import { getAverageBandwidthInStore } from '../peertube-player-local-storage'
import { bytes } from '../utils'

interface StatsCardOptions extends videojs.ComponentOptions {
  videoUUID?: string,
  videoIsLive?: boolean,
  mode?: 'webtorrent' | 'p2p-media-loader'
}

function getListTemplate (
  options: StatsCardOptions,
  player: videojs.Player,
  args: {
    playerNetworkInfo?: any
    videoFile?: any
    progress?: number
  }) {
  const { playerNetworkInfo, videoFile, progress } = args

  const videoQuality: VideoPlaybackQuality = player.getVideoPlaybackQuality()
  const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
  const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
  const pr = (window.devicePixelRatio || 1).toFixed(2)
  const colorspace = videoFile?.metadata?.streams[0]['color_space'] !== "unknown"
    ? videoFile?.metadata?.streams[0]['color_space']
    : undefined

  return `
    <div>
      <div>${player.localize('Video UUID')}</div>
      <span>${options.videoUUID || ''}</span>
    </div>
    <div>
      <div>Viewport / ${player.localize('Frames')}</div>
      <span>${vw}x${vh}*${pr} / ${videoQuality.droppedVideoFrames} dropped of ${videoQuality.totalVideoFrames}</span>
    </div>
    <div${videoFile !== undefined ? '' : ' style="display: none;"'}>
      <div>${player.localize('Resolution')}</div>
      <span>${videoFile?.resolution.label + videoFile?.fps}</span>
    </div>
    <div>
      <div>${player.localize('Volume')}</div>
      <span>${~~(player.volume() * 100)}%${player.muted() ? ' (muted)' : ''}</span>
    </div>
    <div${videoFile !== undefined ? '' : ' style="display: none;"'}>
      <div>${player.localize('Codecs')}</div>
      <span>${videoFile?.metadata?.streams[0]['codec_name'] || 'avc1'}</span>
    </div>
    <div${videoFile !== undefined ? '' : ' style="display: none;"'}>
      <div>${player.localize('Color')}</div>
      <span>${colorspace || 'bt709'}</span>
    </div>
    <div${playerNetworkInfo.averageBandwidth !== undefined ? '' : ' style="display: none;"'}>
      <div>${player.localize('Connection Speed')}</div>
      <span>${playerNetworkInfo.averageBandwidth}</span>
    </div>
    <div${playerNetworkInfo.downloadSpeed !== undefined ? '' : ' style="display: none;"'}>
      <div>${player.localize('Network Activity')}</div>
      <span>${playerNetworkInfo.downloadSpeed} &dArr; / ${playerNetworkInfo.uploadSpeed} &uArr;</span>
    </div>
    <div${playerNetworkInfo.totalDownloaded !== undefined ? '' : ' style="display: none;"'}>
      <div>${player.localize('Total Transfered')}</div>
      <span>${playerNetworkInfo.totalDownloaded} &dArr; / ${playerNetworkInfo.totalUploaded} &uArr;</span>
    </div>
    <div${playerNetworkInfo.downloadedFromServer ? '' : ' style="display: none;"'}>
      <div>${player.localize('Download Breakdown')}</div>
      <span>${playerNetworkInfo.downloadedFromServer} from server · ${playerNetworkInfo.downloadedFromPeers} from peers</span>
    </div>
    <div${progress !== undefined && videoFile !== undefined ? '' : ' style="display: none;"'}>
      <div>${player.localize('Buffer Health')}</div>
      <span>${(progress * 100).toFixed(1)}% (${(progress * videoFile?.metadata?.format.duration).toFixed(1)}s)</span>
    </div>
    <div style="display: none;"> <!-- TODO: implement live latency measure -->
      <div>${player.localize('Live Latency')}</div>
      <span></span>
    </div>
  `
}

function getMainTemplate () {
  return `
    <button class="vjs-stats-close" tabindex=0 aria-label="Close stats" title="Close stats">[x]</button>
    <div class="vjs-stats-list"></div>
  `
}

const Component = videojs.getComponent('Component')
class StatsCard extends Component {
  options_: StatsCardOptions
  container: HTMLDivElement
  list: HTMLDivElement
  closeButton: HTMLElement
  update: any
  source: any

  interval = 300
  playerNetworkInfo: any = {}
  statsForNerdsEvents = new videojs.EventTarget()

  constructor (player: videojs.Player, options: StatsCardOptions) {
    super(player, options)
  }

  createEl () {
    const container = super.createEl('div', {
      className: 'vjs-stats-content',
      innerHTML: getMainTemplate()
    }) as HTMLDivElement
    this.container = container
    this.container.style.display = 'none'

    this.closeButton = this.container.getElementsByClassName('vjs-stats-close')[0] as HTMLElement
    this.closeButton.onclick = () => this.hide()

    this.list = this.container.getElementsByClassName('vjs-stats-list')[0] as HTMLDivElement

    console.log(this.player_.qualityLevels())

    this.player_.on('p2pInfo', (event: any, data: PlayerNetworkInfo) => {
      if (!data) return // HTTP fallback

      this.source = data.source

      const p2pStats = data.p2p
      const httpStats = data.http

      this.playerNetworkInfo.downloadSpeed = bytes(p2pStats.downloadSpeed + httpStats.downloadSpeed).join(' ')
      this.playerNetworkInfo.uploadSpeed = bytes(p2pStats.uploadSpeed + httpStats.uploadSpeed).join(' ')
      this.playerNetworkInfo.totalDownloaded = bytes(p2pStats.downloaded + httpStats.downloaded).join(' ')
      this.playerNetworkInfo.totalUploaded = bytes(p2pStats.uploaded + httpStats.uploaded).join(' ')
      this.playerNetworkInfo.numPeers = p2pStats.numPeers
      this.playerNetworkInfo.averageBandwidth = bytes(getAverageBandwidthInStore() || p2pStats.downloaded + httpStats.downloaded).join(' ')

      if (data.source === 'p2p-media-loader') {
        this.playerNetworkInfo.downloadedFromServer = bytes(httpStats.downloaded).join(' ')
        this.playerNetworkInfo.downloadedFromPeers = bytes(p2pStats.downloaded).join(' ')
      }
    })

    return container
  }

  toggle () {
    this.update
      ? this.hide()
      : this.show()
  }

  show (options?: StatsCardOptions) {
    if (options) this.options_ = options

    let metadata = {}

    this.container.style.display = 'block'
    this.update = setInterval(async () => {
      try {
        if (this.source === 'webtorrent') {
          const progress = this.player_.webtorrent().getTorrent()?.progress
          const videoFile = this.player_.webtorrent().getCurrentVideoFile()
          videoFile.metadata = metadata[videoFile.fileUrl] = videoFile.metadata || metadata[videoFile.fileUrl] || videoFile.metadataUrl && await fetch(videoFile.metadataUrl).then(res => res.json())
          this.list.innerHTML = getListTemplate(this.options_, this.player_, { playerNetworkInfo: this.playerNetworkInfo, videoFile, progress })
        } else {
          this.list.innerHTML = getListTemplate(this.options_, this.player_, { playerNetworkInfo: this.playerNetworkInfo })
        }
      } catch (e) {
        clearInterval(this.update)
      }
    }, this.interval)
  }

  hide () {
    clearInterval(this.update)
    this.container.style.display = 'none'
  }
}

videojs.registerComponent('StatsCard', StatsCard)

export {
  StatsCard,
  StatsCardOptions
}
