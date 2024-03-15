import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { UserRegistration } from '@peertube/peertube-models'
import { AdminRegistrationService } from './admin-registration.service'
import { REGISTRATION_MODERATION_RESPONSE_VALIDATOR } from './process-registration-validators'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { NgIf, NgClass } from '@angular/common'

@Component({
  selector: 'my-process-registration-modal',
  templateUrl: './process-registration-modal.component.html',
  standalone: true,
  imports: [ NgIf, GlobalIconComponent, FormsModule, ReactiveFormsModule, NgClass, PeertubeCheckboxComponent ]
})
export class ProcessRegistrationModalComponent extends FormReactive implements OnInit {
  @ViewChild('modal', { static: true }) modal: NgbModal

  @Output() registrationProcessed = new EventEmitter()

  registration: UserRegistration

  private openedModal: NgbModalRef
  private processMode: 'accept' | 'reject'

  constructor (
    protected formReactiveService: FormReactiveService,
    private server: ServerService,
    private modalService: NgbModal,
    private notifier: Notifier,
    private registrationService: AdminRegistrationService
  ) {
    super()
  }

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

  openModal (registration: UserRegistration, mode: 'accept' | 'reject') {
    this.processMode = mode
    this.registration = registration

    this.form.patchValue({
      preventEmailDelivery: !this.isEmailEnabled() || registration.emailVerified !== true
    })

    this.openedModal = this.modalService.open(this.modal, { centered: true })
  }

  hide () {
    this.form.reset()

    this.openedModal.close()
  }

  getSubmitValue () {
    if (this.isAccept()) {
      return $localize`Accept registration`
    }

    return $localize`Reject registration`
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

  private acceptRegistration () {
    this.registrationService.acceptRegistration({
      registration: this.registration,
      moderationResponse: this.form.value.moderationResponse,
      preventEmailDelivery: this.form.value.preventEmailDelivery
    }).subscribe({
      next: () => {
        this.notifier.success($localize`${this.registration.username} account created`)

        this.registrationProcessed.emit()
        this.hide()
      },

      error: err => this.notifier.error(err.message)
    })
  }

  private rejectRegistration () {
    this.registrationService.rejectRegistration({
      registration: this.registration,
      moderationResponse: this.form.value.moderationResponse,
      preventEmailDelivery: this.form.value.preventEmailDelivery
    }).subscribe({
      next: () => {
        this.notifier.success($localize`${this.registration.username} registration rejected`)

        this.registrationProcessed.emit()
        this.hide()
      },

      error: err => this.notifier.error(err.message)
    })
  }
}
