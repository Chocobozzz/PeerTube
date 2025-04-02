import { timeToInt } from '@peertube/peertube-core-utils'
import videojs, { VideoJsPlayer } from 'video.js'

const TimeToolTip = videojs.getComponent('TimeTooltip') as any // FIXME: typings don't have write method

class TimeTooltip extends TimeToolTip {
  declare private currentTimecode: string

  write (timecode: string) {
    const player: VideoJsPlayer = this.player()

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
