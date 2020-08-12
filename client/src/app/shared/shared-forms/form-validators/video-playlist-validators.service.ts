import { Injectable } from '@angular/core'
import { AbstractControl, Validators } from '@angular/forms'
import { VideoPlaylistPrivacy } from '@shared/models'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class VideoPlaylistValidatorsService {
  readonly VIDEO_PLAYLIST_DISPLAY_NAME: BuildFormValidator
  readonly VIDEO_PLAYLIST_PRIVACY: BuildFormValidator
  readonly VIDEO_PLAYLIST_DESCRIPTION: BuildFormValidator
  readonly VIDEO_PLAYLIST_CHANNEL_ID: BuildFormValidator

  constructor () {
    this.VIDEO_PLAYLIST_DISPLAY_NAME = {
      VALIDATORS: [
        Validators.required,
        Validators.minLength(1),
        Validators.maxLength(120)
      ],
      MESSAGES: {
        'required': $localize`Display name is required.`,
        'minlength': $localize`Display name must be at least 1 character long.`,
        'maxlength': $localize`Display name cannot be more than 120 characters long.`
      }
    }

    this.VIDEO_PLAYLIST_PRIVACY = {
      VALIDATORS: [
        Validators.required
      ],
      MESSAGES: {
        'required': $localize`Privacy is required.`
      }
    }

    this.VIDEO_PLAYLIST_DESCRIPTION = {
      VALIDATORS: [
        Validators.minLength(3),
        Validators.maxLength(1000)
      ],
      MESSAGES: {
        'minlength': $localize`Description must be at least 3 characters long.`,
        'maxlength': $localize`Description cannot be more than 1000 characters long.`
      }
    }

    this.VIDEO_PLAYLIST_CHANNEL_ID = {
      VALIDATORS: [ ],
      MESSAGES: {
        'required': $localize`The channel is required when the playlist is public.`
      }
    }
  }

  setChannelValidator (channelControl: AbstractControl, privacy: VideoPlaylistPrivacy) {
    if (privacy.toString() === VideoPlaylistPrivacy.PUBLIC.toString()) {
      channelControl.setValidators([ Validators.required ])
    } else {
      channelControl.setValidators(null)
    }

    channelControl.markAsDirty()
    channelControl.updateValueAndValidity()
  }
}
