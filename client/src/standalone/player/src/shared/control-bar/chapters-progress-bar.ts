/**
 * @file chapters-progress-bar.ts
 */
import { VideoChapter } from '@peertube/peertube-models'
import videojs from 'video.js'
import type { VideojsComponent, VideojsComponentOptions, VideojsPlayer } from '../../types'
import { sortBy } from '@peertube/peertube-core-utils'

const Component = videojs.getComponent('Component') as typeof VideojsComponent

type ChaptersProgressBarOptions = VideojsComponentOptions & {
  chapters?: VideoChapter[]
  segmentGap?: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

class ChaptersProgressBar extends Component {
  declare private partEls_: HTMLElement[]
  declare private chapters_: VideoChapter[]
  declare private updateHandler_: () => void
  declare options_: ChaptersProgressBarOptions

  constructor (player: VideojsPlayer, options?: ChaptersProgressBarOptions) {
    super(player, options)

    this.partEls_ = []
    this.chapters_ = options?.chapters || []
    this.updateHandler_ = () => this.update()

    this.player().on([ 'durationchange', 'loadedmetadata', 'resize', 'fullscreenchange' ], this.updateHandler_)

    this.update()
  }

  createEl () {
    return super.createEl('div', {
      className: 'vjs-chapters-progress'
    }, {
      'aria-hidden': 'true'
    })
  }

  setChapters (chapters: VideoChapter[]) {
    this.chapters_ = chapters || []
    this.update()
  }

  private clearSegments_ () {
    const children = this.partEls_

    for (let i = children.length - 1; i >= 0; i--) {
      this.el_.removeChild(children[i])
    }

    this.partEls_.length = 0
  }

  update () {
    const chapters = this.chapters_
    const duration = this.player_.duration()

    if (!chapters || chapters.length === 0 || !isFinite(duration) || duration <= 0) {
      this.clearSegments_()
      return
    }

    const seekBarEl = this.parentComponent_?.el()
    const seekBarRect = seekBarEl ? videojs.dom.getBoundingClientRect(seekBarEl) : null
    const gapPx = Math.max(0, this.options_.segmentGap || 0)
    const gapPxValue = (seekBarRect && seekBarRect.width > 0) ? gapPx : 0
    const children = this.partEls_
    let partIndex = 0

    const sortedChapters = sortBy(chapters.slice(), 'timecode')

    if (sortedChapters[0].timecode > 0) {
      sortedChapters.unshift({ timecode: 0, title: '' })
    }

    this.requestNamedAnimationFrame('ChaptersProgressBar#update', () => {
      for (let i = 0; i < sortedChapters.length; i++) {
        const chapter = sortedChapters[i]
        const nextChapter = sortedChapters[i + 1]
        const start = clamp(chapter.timecode, 0, duration)
        const end = clamp(nextChapter?.timecode ?? duration, 0, duration)

        if (end <= start) {
          continue
        }

        const startPercent = (start / duration) * 100
        const widthPercent = ((end - start) / duration) * 100
        let part = children[partIndex]

        if (!part) {
          part = this.el_.appendChild(videojs.dom.createEl('div', {
            className: 'vjs-chapters-progress-part'
          })) as HTMLElement
          children[partIndex] = part
        }

        const nextStart = start.toFixed(3)
        const nextEnd = end.toFixed(3)
        const nextGap = gapPxValue

        if (part.dataset.start === nextStart && part.dataset.end === nextEnd && part.dataset.gap === String(nextGap)) {
          partIndex++
          continue
        }

        part.dataset.start = nextStart
        part.dataset.end = nextEnd
        part.dataset.gap = String(nextGap)

        part.style.left = `${startPercent}%`
        part.style.width = gapPxValue > 0
          ? `calc(${widthPercent}% - ${gapPxValue}px)`
          : `${widthPercent}%`

        partIndex++
      }

      for (let i = children.length - 1; i >= partIndex; i--) {
        this.el_.removeChild(children[i])
      }

      children.length = partIndex
    })
  }

  dispose () {
    this.partEls_ = null
    super.dispose()
  }
}

ChaptersProgressBar.prototype.options_ = {
  segmentGap: 2
}

Component.registerComponent('ChaptersProgressBar', ChaptersProgressBar as any)
export default ChaptersProgressBar
