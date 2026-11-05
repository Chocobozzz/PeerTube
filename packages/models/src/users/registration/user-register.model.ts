import { UserSignupClientType } from './user-signup-client.type.js'

export interface UserRegister {
  username: string
  password: string
  email: string

  displayName?: string

  channel?: {
    name: string
    displayName: string
  }

  // Client used to sign up, to redirect the user to it after email verification or registration approval
  signupClient?: UserSignupClientType
}
