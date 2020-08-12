import { Injectable } from '@angular/core'
import { AbstractControl, ValidationErrors, Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class VideoChangeOwnershipValidatorsService {
  readonly USERNAME: BuildFormValidator

  constructor () {
    this.USERNAME = {
      VALIDATORS: [ Validators.required, this.localAccountValidator ],
      MESSAGES: {
        'required': $localize`The username is required.`,
        'localAccountOnly': $localize`You can only transfer ownership to a local account`
      }
    }
  }

  localAccountValidator (control: AbstractControl): ValidationErrors {
    if (control.value.includes('@')) {
      return { 'localAccountOnly': true }
    }

    return null
  }
}
