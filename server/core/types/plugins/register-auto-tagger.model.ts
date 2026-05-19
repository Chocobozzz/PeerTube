import { MComment } from '../models/video/video-comment.js'
import { MVideo } from '../models/video/video.js'

export type RegisterCommentAutoTaggerOptions = {
  autoTagName: string

  handler: (options: { comment: Pick<MComment, 'text'> }) => Promise<{ result: boolean }>
}

export type RegisterVideoAutoTaggerOptions = {
  autoTagName: string

  handler: (options: { video: Pick<MVideo, 'name' | 'description'> }) => Promise<{ result: boolean }>
}
