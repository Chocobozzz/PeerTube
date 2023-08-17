import { UserRegister } from './user-register.model.js'

export interface UserRegistrationRequest extends UserRegister {
  registrationReason: string
}
