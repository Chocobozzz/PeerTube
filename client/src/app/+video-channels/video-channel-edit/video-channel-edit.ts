import { FormReactive } from '@app/shared/shared-forms'
import { VideoChannel } from '@app/shared/shared-main'

export abstract class MyVideoChannelEdit extends FormReactive {
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
