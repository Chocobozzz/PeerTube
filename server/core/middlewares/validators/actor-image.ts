import { updateActorImageValidatorFactory } from './shared/images.js'

export const updateAvatarValidator = updateActorImageValidatorFactory('avatarfile')
export const updateBannerValidator = updateActorImageValidatorFactory('bannerfile')
