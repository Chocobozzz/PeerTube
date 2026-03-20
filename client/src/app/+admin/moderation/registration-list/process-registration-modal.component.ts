import { CommonModule } from '@angular/common'
import { Component, OnInit, inject, output, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier, ServerService } from '@app/core'
import { formatICU } from '@app/helpers'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { arrayify } from '@peertube/peertube-core-utils'
import { UserRegistration } from '@peertube/peertube-models'
import { from } from 'rxjs'
import { concatMap, toArray } from 'rxjs/operators'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { AdminRegistrationService } from './admin-registration.service'
import { REGISTRATION_MODERATION_RESPONSE_VALIDATOR } from './process-registration-validators'

@Component({
  selector: 'my-process-registration-modal',
  templateUrl: './process-registration-modal.component.html',
  imports: [ CommonModule, GlobalIconComponent, FormsModule, ReactiveFormsModule, PeertubeCheckboxComponent, AlertComponent ]
})
export class ProcessRegistrationModalComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private server = inject(ServerService)
  private modalService = inject(NgbModal)
  private notifier = inject(Notifier)
  private registrationService = inject(AdminRegistrationService)

  readonly modal = viewChild<NgbModal>('modal')

  readonly registrationProcessed = output()

  registrations: UserRegistration[] = []

  private openedModal: NgbModalRef
  private processMode: 'accept' | 'reject'

  ngOnInit () {
    this.buildForm({
      moderationResponse: REGISTRATION_MODERATION_RESPONSE_VALIDATOR,
      preventEmailDelivery: null
    })
  }

  isAccept () {
    return this.processMode === 'accept'
  }

  isReject () {
    return this.processMode === 'reject'
  }

  openModal (registrationsArg: UserRegistration | UserRegistration[], mode: 'accept' | 'reject') {
    this.processMode = mode
    this.registrations = arrayify(registrationsArg)

    if (this.shouldDisableEmailDelivery()) {
      this.form.get('preventEmailDelivery').disable()
    } else {
      this.form.get('preventEmailDelivery').enable()
    }

    this.form.patchValue({
      preventEmailDelivery: this.shouldDisableEmailDelivery()
    })

    this.openedModal = this.modalService.open(this.modal(), { centered: true })
  }

  hide () {
    this.form.reset()
    this.registrations = []

    this.openedModal.close()
  }

  getSubmitValue () {
    const count = this.registrations.length
    const label = this.isAccept()
      ? $localize`{count, plural, =1 {Accept registration} other {Accept registrations}}`
      : $localize`{count, plural, =1 {Reject registration} other {Reject registrations}}`

    return formatICU(label, { count })
  }

  getModalTitle () {
    const count = this.registrations.length
    const label = this.isAccept()
      ? $localize`{count, plural, =1 {Accept registration} other {Accept {count} registrations}}`
      : $localize`{count, plural, =1 {Reject registration} other {Reject {count} registrations}}`

    return formatICU(label, { count })
  }

  hasMultipleRegistrations () {
    return this.registrations.length > 1
  }

  get registration () {
    return this.registrations[0]
  }

  processRegistration () {
    if (this.isAccept()) return this.acceptRegistration()

    return this.rejectRegistration()
  }

  isEmailEnabled () {
    return this.server.getHTMLConfig().email.enabled
  }

  isPreventEmailDeliveryChecked () {
    return this.form.value.preventEmailDelivery
  }

  hasUnverifiedEmails () {
    return this.registrations.some(registration => registration.emailVerified !== true)
  }

  shouldDisableEmailDelivery () {
    return !this.isEmailEnabled() || this.hasUnverifiedEmails()
  }

  private acceptRegistration () {
    const moderationResponse = this.form.value.moderationResponse
    const preventEmailDelivery = this.form.value.preventEmailDelivery

    from(this.registrations)
      .pipe(
        concatMap(registration =>
          this.registrationService.acceptRegistration({
            registration,
            moderationResponse,
            preventEmailDelivery
          })
        ),
        toArray()
      )
      .subscribe({
        next: () => {
          const count = this.registrations.length
          const message = formatICU(
            $localize`{count, plural, =1 {{username} account created} other {{count} accounts created}}`,
            { count, username: this.registration?.username }
          )

          this.notifier.success(message)
          this.registrationProcessed.emit()
          this.hide()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private rejectRegistration () {
    const moderationResponse = this.form.value.moderationResponse
    const preventEmailDelivery = this.form.value.preventEmailDelivery

    from(this.registrations)
      .pipe(
        concatMap(registration =>
          this.registrationService.rejectRegistration({
            registration,
            moderationResponse,
            preventEmailDelivery
          })
        ),
        toArray()
      )
      .subscribe({
        next: () => {
          const count = this.registrations.length
          const message = formatICU(
            $localize`{count, plural, =1 {{username} registration rejected} other {{count} registrations rejected}}`,
            { count, username: this.registration?.username }
          )

          this.notifier.success(message)
          this.registrationProcessed.emit()
          this.hide()
        },

        error: err => this.notifier.handleError(err)
      })
  }
}
