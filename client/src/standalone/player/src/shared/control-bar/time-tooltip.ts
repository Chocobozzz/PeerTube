import { timeToInt } from '@peertube/peertube-core-utils'
import videojs from 'video.js'
import { VideojsTimeTooltip } from '../../types'

const TimeToolTip = videojs.getComponent('TimeTooltip') as typeof VideojsTimeTooltip

class TimeTooltip extends TimeToolTip {
  declare private currentTimecode: string

  write (timecode: string) {
    const player = this.player()

    if (player.usingPlugin('chapters')) {
      if (timecode === this.currentTimecode) return

      this.currentTimecode = timecode
      const { title, fixedTimecode } = player.chapters().getChapter(timeToInt(this.currentTimecode))

      if (title) {
        const timecodeStr = fixedTimecode
          ? videojs.formatTime(fixedTimecode, this.player()?.duration())
          : this.currentTimecode

        return super.write(title + '\r\n' + timecodeStr)
      }
    }

    return super.write(timecode)
  }
}

videojs.registerComponent('TimeTooltip', TimeTooltip)
