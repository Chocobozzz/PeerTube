import { FormReactive } from '@app/shared'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'

export abstract class MyAccountVideoChannelEdit extends FormReactive {
  // We need it even in the create component because it's used in the edit template
  videoChannelToUpdate: VideoChannel
  instanceHost: string

  abstract isCreation (): boolean
  abstract getFormButtonTitle (): string

  // We need this method so angular does not complain in child template that doesn't need this
  onAvatarChange (formData: FormData) { /* empty */ }

  // Should be implemented by the child
  isBulkUpdateVideosDisplayed () {
    return false
  }
}
