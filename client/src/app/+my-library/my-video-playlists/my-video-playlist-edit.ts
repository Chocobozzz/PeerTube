import { VideoConstant, VideoPlaylist, VideoPlaylistPrivacyType } from '@peertube/peertube-models'
import { SelectChannelItem } from '../../../types/select-options-item.model'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'

export abstract class MyVideoPlaylistEdit extends FormReactive {
  // Declare it here to avoid errors in create template
  videoPlaylistToUpdate: VideoPlaylist
  userVideoChannels: SelectChannelItem[] = []
  videoPlaylistPrivacies: VideoConstant<VideoPlaylistPrivacyType>[] = []

  abstract isCreation (): boolean
  abstract getFormButtonTitle (): string
}
