import { AvatarModel } from '../../../models/avatar/avatar'
import { FunctionProperties } from '@shared/core-utils'

export type MAvatar = AvatarModel

// ############################################################################

// Format for API or AP object

export type MAvatarFormattable =
  FunctionProperties<MAvatar> &
  Pick<MAvatar, 'filename' | 'createdAt' | 'updatedAt'>
