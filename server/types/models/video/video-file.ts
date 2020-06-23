import { VideoFileModel } from '../../../models/video/video-file'
import { PickWith, PickWithOpt } from '@shared/core-utils'
import { MVideo, MVideoUUID } from './video'
import { MVideoRedundancy, MVideoRedundancyFileUrl } from './video-redundancy'
import { MStreamingPlaylistVideo, MStreamingPlaylist } from './video-streaming-playlist'

type Use<K extends keyof VideoFileModel, M> = PickWith<VideoFileModel, K, M>

// ############################################################################

export type MVideoFile = Omit<VideoFileModel, 'Video' | 'RedundancyVideos' | 'VideoStreamingPlaylist'>

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

export type MVideoFileRedundanciesAll =
  MVideoFile &
  PickWithOpt<VideoFileModel, 'RedundancyVideos', MVideoRedundancy[]>

export type MVideoFileRedundanciesOpt =
  MVideoFile &
  PickWithOpt<VideoFileModel, 'RedundancyVideos', MVideoRedundancyFileUrl[]>

export function isStreamingPlaylistFile (file: any): file is MVideoFileStreamingPlaylist {
  return !!file.videoStreamingPlaylistId
}

export function isWebtorrentFile (file: any): file is MVideoFileVideo {
  return !!file.videoId
}
