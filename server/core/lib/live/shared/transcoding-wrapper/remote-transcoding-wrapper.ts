import { LiveRTMPHLSTranscodingJobHandler } from '@server/lib/runners/index.js'
import { AbstractTranscodingWrapper } from './abstract-transcoding-wrapper.js'

export class RemoteTranscodingWrapper extends AbstractTranscodingWrapper {
  async run () {
    await new LiveRTMPHLSTranscodingJobHandler().create({
      rtmpUrl: this.inputPublicUrl,
      sessionId: this.sessionId,
      toTranscode: this.toTranscode,
      video: this.videoLive.Video,
      outputDirectory: this.outDirectory,
      playlist: this.streamingPlaylist,
      segmentListSize: this.segmentListSize,
      segmentDuration: this.segmentDuration
    })
  }

  abort () {
    this.emit('end')
  }
}
