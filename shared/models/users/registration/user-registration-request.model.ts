import { UserRegister } from './user-register.model'

export interface UserRegistrationRequest extends UserRegister {
  registrationReason: string
}
