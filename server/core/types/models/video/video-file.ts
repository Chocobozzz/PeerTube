import { PickWith } from '@peertube/peertube-typescript-utils'
import { VideoFileModel } from '../../../models/video/video-file.js'
import { MStreamingPlaylist, MStreamingPlaylistVideo } from './video-streaming-playlist.js'
import { MVideo, MVideoUUID } from './video.js'

type Use<K extends keyof VideoFileModel, M> = PickWith<VideoFileModel, K, M>

// ############################################################################

export type MVideoFile = Omit<VideoFileModel, 'Video' | 'VideoStreamingPlaylist'>

export type MVideoFileVideo =
  MVideoFile &
  Use<'Video', MVideo>

export type MVideoFileStreamingPlaylist =
  MVideoFile &
  Use<'VideoStreamingPlaylist', MStreamingPlaylist>

export type MVideoFileStreamingPlaylistVideo =
  MVideoFile &
  Use<'VideoStreamingPlaylist', MStreamingPlaylistVideo>

export type MVideoFileVideoUUID =
  MVideoFile &
  Use<'Video', MVideoUUID>

export function isStreamingPlaylistFile (file: any): file is MVideoFileStreamingPlaylist {
  return !!file.videoStreamingPlaylistId
}

export function isWebVideoFile (file: any): file is MVideoFileVideo {
  return !!file.videoId
}
