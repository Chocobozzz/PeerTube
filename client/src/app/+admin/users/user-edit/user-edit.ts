import { FormReactive } from '../../../shared'

export abstract class UserEdit extends FormReactive {
  videoQuotaOptions = [
    { value: -1, label: 'Unlimited' },
    { value: 0, label: '0'},
    { value: 100 * 1024 * 1024, label: '100MB' },
    { value: 5 * 1024 * 1024, label: '500MB' },
    { value: 1024 * 1024 * 1024, label: '1GB' },
    { value: 5 * 1024 * 1024 * 1024, label: '5GB' },
    { value: 20 * 1024 * 1024 * 1024, label: '20GB' },
    { value: 50 * 1024 * 1024 * 1024, label: '50GB' }
  ]

  abstract isCreation (): boolean
  abstract getFormButtonTitle (): string
}
