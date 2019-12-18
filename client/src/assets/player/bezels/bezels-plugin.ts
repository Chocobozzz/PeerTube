// @ts-ignore
import * as videojs from 'video.js'
import { VideoJSComponentInterface } from '../peertube-videojs-typings'

function getPauseBezel () {
  return `
  <div class="vjs-bezels-pause">
    <div class="vjs-bezel" role="status" aria-label="Pause">
      <div class="vjs-bezel-icon">
        <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
          <use class="vjs-svg-shadow" xlink:href="#vjs-id-1"></use>
          <path class="vjs-svg-fill" d="M 12,26 16,26 16,10 12,10 z M 21,26 25,26 25,10 21,10 z" id="vjs-id-1"></path>
        </svg>
      </div>
    </div>
  </div>
  `
}

function getPlayBezel () {
  return `
  <div class="vjs-bezels-play">
    <div class="vjs-bezel" role="status" aria-label="Play">
      <div class="vjs-bezel-icon">
        <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
          <use class="vjs-svg-shadow" xlink:href="#vjs-id-2"></use>
          <path class="vjs-svg-fill" d="M 12,26 18.5,22 18.5,14 12,10 z M 18.5,22 25,18 25,18 18.5,14 z" id="ytp-id-2"></path>
        </svg>
      </div>
    </div>
  </div>
  `
}

// @ts-ignore-start
const Component = videojs.getComponent('Component')
class PauseBezel extends Component {
  options_: any
  container: HTMLBodyElement

  constructor (player: videojs.Player, options: any) {
    super(player, options)
    this.options_ = options

    player.on('pause', (_: any) => {
      if (player.seeking()) return
      this.container.innerHTML = getPauseBezel()
      this.showBezel()
    })

    player.on('play', (_: any) => {
      if (player.seeking()) return
      this.container.innerHTML = getPlayBezel()
      this.showBezel()
    })
  }

  createEl () {
    const container = super.createEl('div', {
      className: 'vjs-bezels-content'
    })
    this.container = container
    container.style.display = 'none'

    return container
  }

  showBezel () {
    this.container.style.display = 'inherit'
    setTimeout(() => {
      this.container.style.display = 'none'
    }, 500) // matching the animation duration
  }
}
// @ts-ignore-end

videojs.registerComponent('PauseBezel', PauseBezel)

const Plugin: VideoJSComponentInterface = videojs.getPlugin('plugin')
class BezelsPlugin extends Plugin {
  constructor (player: videojs.Player, options: any = {}) {
    super(player, options)

    this.player.ready(() => {
      player.addClass('vjs-bezels')
    })

    player.addChild('PauseBezel', options)
  }
}

videojs.registerPlugin('bezels', BezelsPlugin)
export { BezelsPlugin }
