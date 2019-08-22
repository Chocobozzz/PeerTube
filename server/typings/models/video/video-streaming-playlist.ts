import { VideoStreamingPlaylistModel } from '../../../models/video/video-streaming-playlist'
import { PickWith, PickWithOpt } from '../../utils'
import { MVideoRedundancyFileUrl } from './video-redundancy'
import { MVideo, MVideoUrl } from '@server/typings/models'

type Use<K extends keyof VideoStreamingPlaylistModel, M> = PickWith<VideoStreamingPlaylistModel, K, M>

// ############################################################################

export type MStreamingPlaylist = Omit<VideoStreamingPlaylistModel, 'Video' | 'RedundancyVideos'>

export type MStreamingPlaylistVideo = MStreamingPlaylist &
  Use<'Video', MVideo>

export type MStreamingPlaylistRedundancies = MStreamingPlaylist &
  Use<'RedundancyVideos', MVideoRedundancyFileUrl[]>

export type MStreamingPlaylistRedundanciesOpt = MStreamingPlaylist &
  PickWithOpt<VideoStreamingPlaylistModel, 'RedundancyVideos', MVideoRedundancyFileUrl[]>
