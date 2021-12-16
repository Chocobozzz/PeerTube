import { FunctionProperties } from '@shared/typescript-utils'
import { ActorImageModel } from '../../../models/actor/actor-image'

export type MActorImage = ActorImageModel

// ############################################################################

// Format for API or AP object

export type MActorImageFormattable =
  FunctionProperties<MActorImage> &
  Pick<MActorImage, 'filename' | 'createdAt' | 'updatedAt'>
