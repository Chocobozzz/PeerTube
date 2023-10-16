import videojs from 'video.js'
import { ChaptersOptions } from '../../types'
import { VideoChapter } from '@peertube/peertube-models'
import { ProgressBarMarkerComponent } from './progress-bar-marker-component'

const Plugin = videojs.getPlugin('plugin')

class ChaptersPlugin extends Plugin {
  private chapters: VideoChapter[] = []
  private markers: ProgressBarMarkerComponent[] = []

  constructor (player: videojs.Player, options: videojs.ComponentOptions & ChaptersOptions) {
    super(player, options)

    this.chapters = options.chapters

    this.player.ready(() => {
      player.addClass('vjs-chapters')

      for (const chapter of this.chapters) {
        if (chapter.timecode === 0) continue

        const marker = new ProgressBarMarkerComponent(player, { timecode: chapter.timecode })

        this.markers.push(marker)
        this.getSeekBar().addChild(marker)
      }
    })
  }

  dispose () {
    for (const marker of this.markers) {
      this.getSeekBar().removeChild(marker)
    }

    super.dispose()
  }

  getChapter (timecode: number) {
    if (this.chapters.length !== 0) {
      for (let i = this.chapters.length - 1; i >= 0; i--) {
        const chapter = this.chapters[i]

        if (chapter.timecode <= timecode) {
          this.player.addClass('has-chapter')

          return chapter.title
        }
      }
    }

    this.player.removeClass('has-chapter')

    return ''
  }

  private getSeekBar () {
    return this.player.getDescendant('ControlBar', 'ProgressControl', 'SeekBar')
  }
}

videojs.registerPlugin('chapters', ChaptersPlugin)

export { ChaptersPlugin }
