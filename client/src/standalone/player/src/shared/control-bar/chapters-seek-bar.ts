/**
 * @file chapters-seek-bar.ts
 */
import videojs from 'video.js'
import type { VideojsComponent, VideojsComponentOptions, VideojsPlayer } from '../../types'

type SeekBarConstructor = typeof import('video.js/dist/types/control-bar/progress-control/seek-bar').default

type ChaptersSeekBarOptions = VideojsComponentOptions & {
  children?: string[]
}

const Component = videojs.getComponent('Component') as typeof VideojsComponent
const SeekBar = videojs.getComponent('SeekBar') as SeekBarConstructor
const mergeOptions = videojs.mergeOptions as (...sources: any[]) => any

class ChaptersSeekBar extends SeekBar {
  constructor (player: VideojsPlayer, options?: ChaptersSeekBarOptions) {
    options = mergeOptions(ChaptersSeekBar.prototype.options_, options)

    // Avoid mutating the prototype's `children` array by creating a copy
    options.children = [ ...options.children ]

    super(player, options as any)
  }

  createEl () {
    const el = super.createEl()

    return el
  }
}

ChaptersSeekBar.prototype.options_ = mergeOptions(SeekBar.prototype.options_, {
  children: [
    'loadProgressBar',
    'playProgressBar'
  ]
})

Component.registerComponent('ChaptersSeekBar', ChaptersSeekBar as any)
export default ChaptersSeekBar
