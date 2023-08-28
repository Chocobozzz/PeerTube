import { timeToInt } from '@peertube/peertube-core-utils'
import videojs, { VideoJsPlayer } from 'video.js'

const TimeToolTip = videojs.getComponent('TimeTooltip') as any // FIXME: typings don't have write method

class TimeTooltip extends TimeToolTip {

  write (timecode: string) {
    const player: VideoJsPlayer = this.player()

    if (player.usingPlugin('chapters')) {
      const chapterTitle = player.chapters().getChapter(timeToInt(timecode))
      if (chapterTitle) return super.write(chapterTitle + '\r\n' + timecode)
    }

    return super.write(timecode)
  }
}

videojs.registerComponent('TimeTooltip', TimeTooltip)
