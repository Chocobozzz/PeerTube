import { VideoStreamingPlaylistModel } from '../../../models/video/video-streaming-playlist'
import { PickWith } from '../../utils'
import { MVideoRedundancyFileUrl } from './video-redundancy'
import { MVideo } from '@server/typings/models'

export type MStreamingPlaylist = Omit<VideoStreamingPlaylistModel, 'Video' | 'RedundancyVideos'>

export type MStreamingPlaylistVideo = MStreamingPlaylist &
  PickWith<VideoStreamingPlaylistModel, 'Video', MVideo>

export type MStreamingPlaylistRedundancies = MStreamingPlaylist &
  PickWith<VideoStreamingPlaylistModel, 'RedundancyVideos', MVideoRedundancyFileUrl[]>
