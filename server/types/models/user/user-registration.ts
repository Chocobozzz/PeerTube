import { UserRegistrationModel } from '@server/models/user/user-registration'
import { PickWith } from '@shared/typescript-utils'
import { MUserId } from './user'

type Use<K extends keyof UserRegistrationModel, M> = PickWith<UserRegistrationModel, K, M>

// ############################################################################

export type MRegistration = Omit<UserRegistrationModel, 'User'>

// ############################################################################

export type MRegistrationFormattable =
  MRegistration &
  Use<'User', MUserId>
