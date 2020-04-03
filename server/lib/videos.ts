import { isStreamingPlaylist, MStreamingPlaylistVideo, MVideo, MVideoFile } from '@server/typings/models'
import { VideoTranscodingPayload } from '@server/lib/job-queue/handlers/video-transcoding'
import { DEFAULT_AUDIO_RESOLUTION } from '@server/initializers/constants'
import { JobQueue } from '@server/lib/job-queue'

function extractVideo (videoOrPlaylist: MVideo | MStreamingPlaylistVideo) {
  return isStreamingPlaylist(videoOrPlaylist)
    ? videoOrPlaylist.Video
    : videoOrPlaylist
}

function addOptimizeOrMergeAudioJob (video: MVideo, videoFile: MVideoFile) {
  let dataInput: VideoTranscodingPayload

  if (videoFile.isAudio()) {
    dataInput = {
      type: 'merge-audio' as 'merge-audio',
      resolution: DEFAULT_AUDIO_RESOLUTION,
      videoUUID: video.uuid,
      isNewVideo: true
    }
  } else {
    dataInput = {
      type: 'optimize' as 'optimize',
      videoUUID: video.uuid,
      isNewVideo: true
    }
  }

  return JobQueue.Instance.createJobWithPromise({ type: 'video-transcoding', payload: dataInput })
}

export {
  addOptimizeOrMergeAudioJob,
  extractVideo
}
