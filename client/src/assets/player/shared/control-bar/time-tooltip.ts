import { timeToInt } from '@peertube/peertube-core-utils'
import videojs, { VideoJsPlayer } from 'video.js'

const TimeToolTip = videojs.getComponent('TimeTooltip') as any // FIXME: typings don't have write method

class TimeTooltip extends TimeToolTip {
  declare private currentTimecode: string
  declare private currentChapterTitle: string

  write (timecode: string) {
    const player: VideoJsPlayer = this.player()

    if (player.usingPlugin('chapters')) {
      if (timecode === this.currentTimecode) return

      this.currentTimecode = timecode
      this.currentChapterTitle = player.chapters().getChapter(timeToInt(this.currentTimecode))

      if (this.currentChapterTitle) return super.write(this.currentChapterTitle + '\r\n' + this.currentTimecode)
    }

    return super.write(timecode)
  }
}

videojs.registerComponent('TimeTooltip', TimeTooltip)
