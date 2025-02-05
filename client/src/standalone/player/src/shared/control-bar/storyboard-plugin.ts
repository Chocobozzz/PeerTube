import videojs from 'video.js'
import { StoryboardOptions } from '../../types'

// Big thanks to this beautiful plugin: https://github.com/phloxic/videojs-sprite-thumbnails
// Adapted to respect peertube player style

const Plugin = videojs.getPlugin('plugin')

class StoryboardPlugin extends Plugin {
  declare private url: string
  declare private height: number
  declare private width: number
  declare private interval: number

  declare private cached: boolean

  declare private mouseTimeTooltip: videojs.MouseTimeDisplay
  declare private seekBar: { el(): HTMLElement, mouseTimeDisplay: any, playProgressBar: any }
  declare private progress: any

  declare private spritePlaceholder: HTMLElement

  declare private readonly sprites: { [id: string]: HTMLImageElement }

  declare private readonly boundedHijackMouseTooltip: typeof StoryboardPlugin.prototype.hijackMouseTooltip

  declare private onReadyOrLoadstartHandler: (event: { type: 'ready' }) => void

  constructor (player: videojs.Player, options: videojs.ComponentOptions & StoryboardOptions) {
    super(player, options)

    this.url = options.url
    this.height = options.height
    this.width = options.width
    this.interval = options.interval

    this.sprites = {}

    this.boundedHijackMouseTooltip = this.hijackMouseTooltip.bind(this)

    this.init()

    this.player.ready(() => {
      player.addClass('vjs-storyboard')
    })
  }

  init () {
    const controls = this.player.controlBar as any

    // default control bar component tree is expected
    // https://docs.videojs.com/tutorial-components.html#default-component-tree
    this.progress = controls?.progressControl
    this.seekBar = this.progress?.seekBar

    this.mouseTimeTooltip = this.seekBar?.mouseTimeDisplay?.timeTooltip

    this.spritePlaceholder = videojs.dom.createEl('div', { className: 'vjs-storyboard-sprite-placeholder' }) as HTMLElement
    this.seekBar?.el()?.appendChild(this.spritePlaceholder)

    this.onReadyOrLoadstartHandler = event => {
      if (event.type !== 'ready') {
        const spriteSource = this.player.currentSources().find(source => {
          return Object.prototype.hasOwnProperty.call(source, 'storyboard')
        }) as any
        const spriteOpts = spriteSource?.['storyboard'] as StoryboardOptions

        if (spriteOpts) {
          this.url = spriteOpts.url
          this.height = spriteOpts.height
          this.width = spriteOpts.width
          this.interval = spriteOpts.interval
        }
      }

      this.cached = !!this.sprites[this.url]

      this.load()
    }

    this.player.on([ 'ready', 'loadstart' ], this.onReadyOrLoadstartHandler)
  }

  dispose () {
    if (this.onReadyOrLoadstartHandler) this.player.off([ 'ready', 'loadstart' ], this.onReadyOrLoadstartHandler)
    if (this.progress) this.progress.off([ 'mousemove', 'touchmove' ], this.boundedHijackMouseTooltip)

    this.seekBar?.el()?.removeChild(this.spritePlaceholder)

    super.dispose()
  }

  private load () {
    const spriteEvents = [ 'mousemove', 'touchmove' ]

    if (this.isReady()) {
      if (!this.cached) {
        this.sprites[this.url] = videojs.dom.createEl('img', {
          src: this.url
        })
      }
      this.progress.on(spriteEvents, this.boundedHijackMouseTooltip)
    } else {
      this.progress.off(spriteEvents, this.boundedHijackMouseTooltip)

      this.resetMouseTooltip()
    }
  }

  private hijackMouseTooltip (evt: Event) {
    const sprite = this.sprites[this.url]
    const imgWidth = sprite.naturalWidth
    const imgHeight = sprite.naturalHeight
    const seekBarEl = this.seekBar.el()

    if (!sprite.complete || !imgWidth || !imgHeight) {
      this.resetMouseTooltip()
      return
    }

    this.player.requestNamedAnimationFrame('StoryBoardPlugin#hijackMouseTooltip', () => {
      const seekBarRect = videojs.dom.getBoundingClientRect(seekBarEl)
      const playerRect = videojs.dom.getBoundingClientRect(this.player.el())

      if (!seekBarRect || !playerRect) return

      const seekBarX = videojs.dom.getPointerPosition(seekBarEl, evt).x
      let position = seekBarX * this.player.duration()

      const maxPosition = Math.round((imgHeight / this.height) * (imgWidth / this.width)) - 1
      position = Math.min(position / this.interval, maxPosition)

      const responsive = 600
      const playerWidth = this.player.currentWidth()
      const scaleFactor = responsive && playerWidth < responsive
        ? playerWidth / responsive
        : 1
      const columns = imgWidth / this.width

      const scaledWidth = this.width * scaleFactor
      const scaledHeight = this.height * scaleFactor
      const cleft = Math.floor(position % columns) * -scaledWidth
      const ctop = Math.floor(position / columns) * -scaledHeight

      const bgSize = `${imgWidth * scaleFactor}px ${imgHeight * scaleFactor}px`

      const timeTooltip = this.player.el().querySelector('.vjs-time-tooltip')
      const topOffset = -scaledHeight + parseInt(getComputedStyle(timeTooltip).top.replace('px', '')) - 20

      const previewHalfSize = Math.round(scaledWidth / 2)
      let left = seekBarRect.width * seekBarX - previewHalfSize

      // Seek bar doesn't take all the player width, so we can add/minus a few more pixels
      const minLeft = playerRect.left - seekBarRect.left
      const maxLeft = seekBarRect.width - scaledWidth + (playerRect.right - seekBarRect.right)

      if (left < minLeft) left = minLeft
      if (left > maxLeft) left = maxLeft

      const tooltipStyle: { [id: string]: string } = {
        'background-image': `url("${this.url}")`,
        'background-repeat': 'no-repeat',
        'background-position': `${cleft}px ${ctop}px`,
        'background-size': bgSize,

        'color': '#fff',
        'text-shadow': '1px 1px #000',

        'position': 'relative',

        'top': `${topOffset}px`,

        'border': '1px solid #000',

        // border should not overlay thumbnail area
        'width': `${scaledWidth + 2}px`,
        'height': `${scaledHeight + 2}px`
      }

      tooltipStyle.left = `${left}px`

      for (const [ key, value ] of Object.entries(tooltipStyle)) {
        this.spritePlaceholder.style.setProperty(key, value)
      }
    })
  }

  private resetMouseTooltip () {
    if (this.spritePlaceholder) {
      this.spritePlaceholder.style.cssText = ''
    }
  }

  private isReady () {
    return this.mouseTimeTooltip && this.width && this.height && this.url
  }
}

videojs.registerPlugin('storyboard', StoryboardPlugin)

export { StoryboardPlugin }
