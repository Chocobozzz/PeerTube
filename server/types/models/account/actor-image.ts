import { ActorImageModel } from '../../../models/account/actor-image'
import { FunctionProperties } from '@shared/core-utils'

export type MActorImage = ActorImageModel

// ############################################################################

// Format for API or AP object

export type MActorImageFormattable =
  FunctionProperties<MActorImage> &
  Pick<MActorImage, 'filename' | 'createdAt' | 'updatedAt'>
