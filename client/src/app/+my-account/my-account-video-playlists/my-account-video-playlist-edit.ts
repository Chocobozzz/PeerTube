import { FormReactive } from '@app/shared'
import { VideoPlaylist } from '@shared/models/videos/playlist/video-playlist.model'
import { VideoConstant, VideoPlaylistPrivacy } from '@shared/models'

export abstract class MyAccountVideoPlaylistEdit extends FormReactive {
  // Declare it here to avoid errors in create template
  videoPlaylistToUpdate: VideoPlaylist
  userVideoChannels: { id: number, label: string }[] = []
  videoPlaylistPrivacies: VideoConstant<VideoPlaylistPrivacy>[] = []

  abstract isCreation (): boolean
  abstract getFormButtonTitle (): string
}
