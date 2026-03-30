import { VideoChapter } from '@peertube/peertube-models'
import videojs from 'video.js'
import { ChaptersOptions, VideojsPlayer, VideojsPlugin } from '../../types'
import ChaptersProgressBar from './chapters-progress-bar'

const Plugin = videojs.getPlugin('plugin') as typeof VideojsPlugin

class ChaptersPlugin extends Plugin {
  declare private chapters: VideoChapter[]
  declare private progressBar: ChaptersProgressBar

  private activeChapter: VideoChapter

  constructor (player: VideojsPlayer, options: ChaptersOptions) {
    super(player)

    this.chapters = options.chapters

    this.player.ready(() => {
      player.addClass('vjs-chapters')

      this.progressBar = new ChaptersProgressBar(player, { chapters: this.chapters })
      const seekBar = this.getSeekBar()
      const playProgressBar = seekBar.getChild('playProgressBar')

      if (playProgressBar) {
        const playIndex = seekBar.children().indexOf(playProgressBar)
        if (playIndex >= 0) {
          seekBar.addChild(this.progressBar, {}, playIndex)
        } else {
          seekBar.addChild(this.progressBar)
        }
      } else {
        seekBar.addChild(this.progressBar)
      }
    })
  }

  dispose () {
    if (this.progressBar) {
      this.getSeekBar().removeChild(this.progressBar)
      this.progressBar = undefined
    }

    super.dispose()
  }

  getChapter (timecode: number) {
    if (this.activeChapter) {
      this.player.addClass('has-chapter')

      return { title: this.activeChapter.title, fixedTimecode: this.activeChapter.timecode }
    }

    if (this.chapters.length !== 0) {
      for (let i = this.chapters.length - 1; i >= 0; i--) {
        const chapter = this.chapters[i]

        if (chapter.timecode <= timecode) {
          this.player.addClass('has-chapter')

          return { title: chapter.title }
        }
      }
    }

    this.player.removeClass('has-chapter')

    return { title: '' }
  }

  private getSeekBar () {
    return this.player.getDescendant('ControlBar', 'ProgressControl', 'SeekBar')
  }
}

videojs.registerPlugin('chapters', ChaptersPlugin)

export { ChaptersPlugin }
