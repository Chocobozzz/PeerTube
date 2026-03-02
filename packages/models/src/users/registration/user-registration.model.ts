import { UserRegistrationStateType } from './user-registration-state.model.js'

export interface UserRegistration {
  id: number

  state: {
    id: UserRegistrationStateType
    label: string
  }

  registrationReason: string
  moderationResponse: string

  username: string
  email: string
  emailVerified: boolean

  accountDisplayName: string

  channelHandle: string
  channelDisplayName: string

  createdAt: Date
  updatedAt: Date

  user?: {
    id: number
  }
}
