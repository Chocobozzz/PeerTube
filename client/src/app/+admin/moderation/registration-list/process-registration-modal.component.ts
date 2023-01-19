import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { FormReactive, FormReactiveService } from '@app/shared/shared-forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { UserRegistration } from '@shared/models'
import { AdminRegistrationService } from './admin-registration.service'
import { REGISTRATION_MODERATION_RESPONSE_VALIDATOR } from './process-registration-validators'

@Component({
  selector: 'my-process-registration-modal',
  templateUrl: './process-registration-modal.component.html',
  styleUrls: [ './process-registration-modal.component.scss' ]
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
      moderationResponse: REGISTRATION_MODERATION_RESPONSE_VALIDATOR
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

  private acceptRegistration () {
    this.registrationService.acceptRegistration(this.registration, this.form.value.moderationResponse)
      .subscribe({
        next: () => {
          this.notifier.success($localize`${this.registration.username} account created`)

          this.registrationProcessed.emit()
          this.hide()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private rejectRegistration () {
    this.registrationService.rejectRegistration(this.registration, this.form.value.moderationResponse)
      .subscribe({
        next: () => {
          this.notifier.success($localize`${this.registration.username} registration rejected`)

          this.registrationProcessed.emit()
          this.hide()
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
