import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { VideoPlaylist } from '@app/shared/shared-video-playlist/video-playlist.model'
import { VideoConstant, VideoPlaylistPrivacyType } from '@peertube/peertube-models'
import { SelectChannelItem } from '../../../types/select-options-item.model'

export abstract class MyVideoPlaylistEdit extends FormReactive {
  // Declare it here to avoid errors in create template
  videoPlaylistToUpdate: VideoPlaylist
  userVideoChannels: SelectChannelItem[] = []
  videoPlaylistPrivacies: VideoConstant<VideoPlaylistPrivacyType>[] = []

  abstract isCreation (): boolean
  abstract getFormButtonTitle (): string
}
