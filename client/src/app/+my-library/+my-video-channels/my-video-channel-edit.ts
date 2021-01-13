import { FormReactive } from '@app/shared/shared-forms'
import { VideoChannel } from '@app/shared/shared-main'

export abstract class MyVideoChannelEdit extends FormReactive {
  // We need it even in the create component because it's used in the edit template
  videoChannelToUpdate: VideoChannel

  abstract isCreation (): boolean
  abstract getFormButtonTitle (): string

  get instanceHost () {
    return window.location.host
  }

  // We need this method so angular does not complain in child template that doesn't need this
  onAvatarChange (formData: FormData) { /* empty */ }
  onAvatarDelete () { /* empty */ }

  // Should be implemented by the child
  isBulkUpdateVideosDisplayed () {
    return false
  }
}
