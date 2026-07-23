import { PickWith, PickWithOpt } from '@peertube/peertube-typescript-utils'
import { VideoStreamingPlaylistModel } from '../../../models/video/video-streaming-playlist.js'
import { MVideoFile, MVideoFileInfoHash } from './video-file.js'
import { MInfohash } from './video-infohash.js'
import { MVideoRedundancy, MVideoRedundancyFileUrl } from './video-redundancy.js'
import { MVideo, MVideoUUID } from './video.js'

type Use<K extends keyof VideoStreamingPlaylistModel, M> = PickWith<VideoStreamingPlaylistModel, K, M>

// ############################################################################

export type MStreamingPlaylist = Omit<VideoStreamingPlaylistModel, 'Video' | 'RedundancyVideos' | 'VideoFiles' | 'InfoHashes'>

export type MStreamingPlaylistInfoHash =
  & MStreamingPlaylist
  & Use<'InfoHashes', MInfohash[]>

export type MStreamingPlaylistFiles =
  & MStreamingPlaylist
  & Use<'VideoFiles', MVideoFile[]>

export type MStreamingPlaylistVideo =
  & MStreamingPlaylist
  & Use<'Video', MVideo>

export type MStreamingPlaylistVideoUUID =
  & MStreamingPlaylist
  & Use<'Video', MVideoUUID>

export type MStreamingPlaylistFilesVideo =
  & MStreamingPlaylist
  & Use<'VideoFiles', MVideoFile[]>
  & Use<'Video', MVideo>

export type MStreamingPlaylistRedundanciesAll =
  & MStreamingPlaylist
  & Use<'VideoFiles', MVideoFile[]>
  & Use<'RedundancyVideos', MVideoRedundancy[]>

export type MStreamingPlaylistRedundancies =
  & MStreamingPlaylist
  & Use<'VideoFiles', MVideoFile[]>
  & Use<'RedundancyVideos', MVideoRedundancyFileUrl[]>

export type MStreamingPlaylistFormattable =
  & MStreamingPlaylist
  & Use<'VideoFiles', MVideoFile[]>
  & PickWithOpt<VideoStreamingPlaylistModel, 'RedundancyVideos', MVideoRedundancyFileUrl[]>

// Infohashes are needed to build the P2P media loader tags of the AP object
export type MStreamingPlaylistAP =
  & MStreamingPlaylistInfoHash
  & Use<'VideoFiles', MVideoFileInfoHash[]>

export function isStreamingPlaylist (value: MVideo | MStreamingPlaylistVideo): value is MStreamingPlaylistVideo {
  return !!(value as MStreamingPlaylist).videoId
}
