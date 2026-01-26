import { inject, Injectable } from '@angular/core'
import { FormReactiveErrors } from '@app/shared/form-validators/form-validator.model'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { VideoChannelEdit } from './video-channel-edit.model'
import { Subject } from 'rxjs'

export type EditMode = 'create' | 'update'

@Injectable()
export class VideoChannelEditControllerService {
  private formReactiveService = inject(FormReactiveService)

  private error = ''
  private videoChannelEdit: VideoChannelEdit
  private mode: EditMode

  private formErrors: { page: string, path: string, errors: string[] }[] = []
  private saveHook: () => Promise<any>

  private readonly storeChanges = new Subject<void>()

  setStore (videoChannelEdit: VideoChannelEdit) {
    this.videoChannelEdit = videoChannelEdit

    this.storeChanges.next()
  }

  getStore () {
    return this.videoChannelEdit
  }

  getStoreChangesObs () {
    return this.storeChanges.asObservable()
  }

  // ---------------------------------------------------------------------------

  getMode () {
    return this.mode
  }

  setMode (mode: EditMode) {
    this.mode = mode
  }

  // ---------------------------------------------------------------------------

  setError (error: string) {
    this.error = error
  }

  resetError () {
    this.setError('')
  }

  getError () {
    return this.error
  }

  // ---------------------------------------------------------------------------

  setFormError (page: string, path: string, formErrors: FormReactiveErrors) {
    const errors = this.formReactiveService.grabAllErrors(formErrors)
    this.formErrors = this.formErrors.filter(e => e.page !== page)

    if (errors.length === 0) return

    this.formErrors.push({ page, path, errors })
  }

  getFormErrors () {
    return this.formErrors
  }

  hasFormErrors () {
    return this.formErrors.some(({ errors }) => errors.length !== 0)
  }

  // ---------------------------------------------------------------------------

  registerSaveHook (fn: () => Promise<any> | any) {
    this.saveHook = fn
  }

  unregisterSaveHook () {
    this.saveHook = undefined
  }

  runSaveHook () {
    if (!this.saveHook) return Promise.resolve()

    return this.saveHook()
  }
}
