import { FormReactive } from '@app/shared'

export abstract class MyAccountVideoChannelEdit extends FormReactive {
  abstract isCreation (): boolean
  abstract getFormButtonTitle (): string
}
