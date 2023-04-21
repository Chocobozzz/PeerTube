import { LiveRTMPHLSTranscodingJobHandler } from '@server/lib/runners'
import { AbstractTranscodingWrapper } from './abstract-transcoding-wrapper'

export class RemoteTranscodingWrapper extends AbstractTranscodingWrapper {
  async run () {
    await new LiveRTMPHLSTranscodingJobHandler().create({
      rtmpUrl: this.inputUrl,
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
