import { FormReactive } from '@app/shared'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'

export abstract class MyAccountVideoChannelEdit extends FormReactive {
  // We need it even in the create component because it's used in the edit template
  videoChannelToUpdate: VideoChannel

  abstract isCreation (): boolean
  abstract getFormButtonTitle (): string
}
