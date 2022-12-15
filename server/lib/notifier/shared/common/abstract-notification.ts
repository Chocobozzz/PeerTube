import { MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models'
import { EmailPayload, UserNotificationSettingValue } from '@shared/models'

export abstract class AbstractNotification <T, U = MUserWithNotificationSetting> {

  constructor (protected readonly payload: T) {

  }

  abstract prepare (): Promise<void>
  abstract log (): void

  abstract getSetting (user: U): UserNotificationSettingValue
  abstract getTargetUsers (): U[]

  abstract createNotification (user: U): UserNotificationModelForApi
  abstract createEmail (to: string): EmailPayload | Promise<EmailPayload>

  isDisabled (): boolean | Promise<boolean> {
    return false
  }

}
