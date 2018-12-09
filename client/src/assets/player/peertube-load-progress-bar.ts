import { VideoJSComponentInterface, videojsUntyped } from './peertube-videojs-typings'
// FIXME: something weird with our path definition in tsconfig and typings
// @ts-ignore
import { Player } from 'video.js'

const Component: VideoJSComponentInterface = videojsUntyped.getComponent('Component')

class PeerTubeLoadProgressBar extends Component {

  constructor (player: Player, options: any) {
    super(player, options)
    this.partEls_ = []
    this.on(player, 'progress', this.update)
  }

  createEl () {
    return super.createEl('div', {
      className: 'vjs-load-progress',
      innerHTML: `<span class="vjs-control-text"><span>${this.localize('Loaded')}</span>: 0%</span>`
    })
  }

  dispose () {
    this.partEls_ = null

    super.dispose()
  }

  update () {
    const torrent = this.player().peertube().getTorrent()
    if (!torrent) return

    this.el_.style.width = (torrent.progress * 100) + '%'
  }

}

Component.registerComponent('PeerTubeLoadProgressBar', PeerTubeLoadProgressBar)
