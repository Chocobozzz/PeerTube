import { CommentAutomaticTagsTrigger, VideoAutomaticTagsTrigger } from '@peertube/peertube-models'
import { MComment } from '../models/video/video-comment.js'
import { MVideo } from '../models/video/video.js'

// Auto taggers are executed by the `build-object-automatic-tags` job, outside of any transaction: they are allowed to
// take a long time to return their result, for example to analyze the video files or to call an external service
// The handler can only assign tags it declared in `autoTagNames`, other returned tags are ignored

export type RegisterCommentAutoTaggerOptions = {
  autoTagNames: string[]

  handler: (options: {
    comment: Pick<MComment, 'text'>

    // Why the tags are built
    trigger: CommentAutomaticTagsTrigger

    // Tags the comment currently has (built by the previous run of this auto tagger)
    // The returned tags replace them: return the ones you want to keep if you skip the analysis of the comment
    currentTags: string[]
  }) => Promise<{ tags: string[] }>
}

export type RegisterVideoAutoTaggerOptions = {
  autoTagNames: string[]

  // Only the video id/name/description are provided: use `peertubeHelpers.videos.getFiles(video.id)` and
  // `peertubeHelpers.videos.ffprobe(path)` to load and analyze its files if needed
  // A live video has no file yet when its auto taggers run
  // They run again with `new-file` (or `new-video` for a replay saved in another video) when its replay is saved
  handler: (options: {
    video: Pick<MVideo, 'id' | 'name' | 'description'>

    // Why the tags are built
    trigger: VideoAutomaticTagsTrigger

    // Tags the video currently has (built by the previous run of this auto tagger)
    // The returned tags replace them: return the ones you want to keep if you skip the analysis of the video files
    currentTags: string[]
  }) => Promise<{ tags: string[] }>
}
