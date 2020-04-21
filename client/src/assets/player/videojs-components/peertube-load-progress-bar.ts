import videojs from 'video.js'

const Component = videojs.getComponent('Component')

class PeerTubeLoadProgressBar extends Component {

  constructor (player: videojs.Player, options?: videojs.ComponentOptions) {
    super(player, options)

    this.on(player, 'progress', this.update)
  }

  createEl () {
    return super.createEl('div', {
      className: 'vjs-load-progress',
      innerHTML: `<span class="vjs-control-text"><span>${this.localize('Loaded')}</span>: 0%</span>`
    })
  }

  dispose () {
    super.dispose()
  }

  update () {
    const torrent = this.player().webtorrent().getTorrent()
    if (!torrent) return

    // FIXME: typings
    (this.el() as HTMLElement).style.width = (torrent.progress * 100) + '%'
  }

}

Component.registerComponent('PeerTubeLoadProgressBar', PeerTubeLoadProgressBar)
