import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'

export abstract class VideoChannelEdit extends FormReactive {
  videoChannel: VideoChannel

  abstract isCreation (): boolean
  abstract getFormButtonTitle (): string

  get instanceHost () {
    return window.location.host
  }

  // Should be implemented by the child
  isBulkUpdateVideosDisplayed () {
    return false
  }
}
