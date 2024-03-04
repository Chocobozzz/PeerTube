import { FormReactiveService } from './form-reactive.service'
import { FormValidatorService } from './form-validator.service'

export function getFormProviders () {
  return [ FormValidatorService, FormReactiveService ]
}
