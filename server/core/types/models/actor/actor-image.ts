import { FunctionProperties } from '@peertube/peertube-typescript-utils'
import { ActorImageModel } from '../../../models/actor/actor-image.js'

export type MActorImage = ActorImageModel

// ############################################################################

export type MActorImagePath = Pick<MActorImage, 'type' | 'filename' | 'getStaticPath'>

// Format for API or AP object

export type MActorImageFormattable =
  FunctionProperties<MActorImage> &
  Pick<MActorImage, 'type' | 'getStaticPath' | 'width' | 'filename' | 'createdAt' | 'updatedAt'>
