import { PickWith, PickWithOpt } from '@peertube/peertube-typescript-utils'
import { VideoStreamingPlaylistModel } from '../../../models/video/video-streaming-playlist.js'
import { MVideo } from './video.js'
import { MVideoFile } from './video-file.js'
import { MVideoRedundancy, MVideoRedundancyFileUrl } from './video-redundancy.js'

type Use<K extends keyof VideoStreamingPlaylistModel, M> = PickWith<VideoStreamingPlaylistModel, K, M>

// ############################################################################

export type MStreamingPlaylist = Omit<VideoStreamingPlaylistModel, 'Video' | 'RedundancyVideos' | 'VideoFiles'>

export type MStreamingPlaylistFiles =
  MStreamingPlaylist &
  Use<'VideoFiles', MVideoFile[]>

export type MStreamingPlaylistVideo =
  MStreamingPlaylist &
  Use<'Video', MVideo>

export type MStreamingPlaylistFilesVideo =
  MStreamingPlaylist &
  Use<'VideoFiles', MVideoFile[]> &
  Use<'Video', MVideo>

export type MStreamingPlaylistRedundanciesAll =
  MStreamingPlaylist &
  Use<'VideoFiles', MVideoFile[]> &
  Use<'RedundancyVideos', MVideoRedundancy[]>

export type MStreamingPlaylistRedundancies =
  MStreamingPlaylist &
  Use<'VideoFiles', MVideoFile[]> &
  Use<'RedundancyVideos', MVideoRedundancyFileUrl[]>

export type MStreamingPlaylistRedundanciesOpt =
  MStreamingPlaylist &
  Use<'VideoFiles', MVideoFile[]> &
  PickWithOpt<VideoStreamingPlaylistModel, 'RedundancyVideos', MVideoRedundancyFileUrl[]>

export function isStreamingPlaylist (value: MVideo | MStreamingPlaylistVideo): value is MStreamingPlaylistVideo {
  return !!(value as MStreamingPlaylist).videoId
}
