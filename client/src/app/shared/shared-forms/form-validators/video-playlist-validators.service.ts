import { I18n } from '@ngx-translate/i18n-polyfill'
import { AbstractControl, FormControl, Validators } from '@angular/forms'
import { Injectable } from '@angular/core'
import { BuildFormValidator } from './form-validator.service'
import { VideoPlaylistPrivacy } from '@shared/models'

@Injectable()
export class VideoPlaylistValidatorsService {
  readonly VIDEO_PLAYLIST_DISPLAY_NAME: BuildFormValidator
  readonly VIDEO_PLAYLIST_PRIVACY: BuildFormValidator
  readonly VIDEO_PLAYLIST_DESCRIPTION: BuildFormValidator
  readonly VIDEO_PLAYLIST_CHANNEL_ID: BuildFormValidator

  constructor (private i18n: I18n) {
    this.VIDEO_PLAYLIST_DISPLAY_NAME = {
      VALIDATORS: [
        Validators.required,
        Validators.minLength(1),
        Validators.maxLength(120)
      ],
      MESSAGES: {
        'required': this.i18n('Display name is required.'),
        'minlength': this.i18n('Display name must be at least 1 character long.'),
        'maxlength': this.i18n('Display name cannot be more than 120 characters long.')
      }
    }

    this.VIDEO_PLAYLIST_PRIVACY = {
      VALIDATORS: [
        Validators.required
      ],
      MESSAGES: {
        'required': this.i18n('Privacy is required.')
      }
    }

    this.VIDEO_PLAYLIST_DESCRIPTION = {
      VALIDATORS: [
        Validators.minLength(3),
        Validators.maxLength(1000)
      ],
      MESSAGES: {
        'minlength': i18n('Description must be at least 3 characters long.'),
        'maxlength': i18n('Description cannot be more than 1000 characters long.')
      }
    }

    this.VIDEO_PLAYLIST_CHANNEL_ID = {
      VALIDATORS: [ ],
      MESSAGES: {
        'required': this.i18n('The channel is required when the playlist is public.')
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
