import { VideoRedundancyModel } from '../../../models/redundancy/video-redundancy'
import { PickWith } from '@server/typings/utils'
import { MStreamingPlaylistVideo, MVideoFile, MVideoFileVideo } from '@server/typings/models'

export type MVideoRedundancy = Omit<VideoRedundancyModel, 'VideoFile' | 'VideoStreamingPlaylist' | 'Actor'>

export type MVideoRedundancyFileUrl = Pick<MVideoRedundancy, 'fileUrl'>

export type MVideoRedundancyFile = MVideoRedundancy &
  PickWith<VideoRedundancyModel, 'VideoFile', MVideoFile>

export type MVideoRedundancyFileVideo = MVideoRedundancy &
  PickWith<VideoRedundancyModel, 'VideoFile', MVideoFileVideo>

export type MVideoRedundancyStreamingPlaylistVideo = MVideoRedundancy &
  PickWith<VideoRedundancyModel, 'VideoStreamingPlaylist', MStreamingPlaylistVideo>

export type MVideoRedundancyVideo = MVideoRedundancyFileVideo | MVideoRedundancyStreamingPlaylistVideo
