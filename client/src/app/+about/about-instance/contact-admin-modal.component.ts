import { Component, OnInit, ViewChild } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { FormReactive, InstanceValidatorsService } from '@app/shared'
import { InstanceService } from '@app/shared/instance/instance.service'

@Component({
  selector: 'my-contact-admin-modal',
  templateUrl: './contact-admin-modal.component.html',
  styleUrls: [ './contact-admin-modal.component.scss' ]
})
export class ContactAdminModalComponent extends FormReactive implements OnInit {
  @ViewChild('modal') modal: NgbModal

  error: string

  private openedModal: NgbModalRef

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private instanceValidatorsService: InstanceValidatorsService,
    private instanceService: InstanceService,
    private serverService: ServerService,
    private notifier: Notifier,
    private i18n: I18n
  ) {
    super()
  }

  get instanceName () {
    return this.serverService.getConfig().instance.name
  }

  ngOnInit () {
    this.buildForm({
      fromName: this.instanceValidatorsService.FROM_NAME,
      fromEmail: this.instanceValidatorsService.FROM_EMAIL,
      body: this.instanceValidatorsService.BODY
    })
  }

  show () {
    this.openedModal = this.modalService.open(this.modal, { keyboard: false })
  }

  hide () {
    this.form.reset()
    this.error = undefined

    this.openedModal.close()
    this.openedModal = null
  }

  sendForm () {
    const fromName = this.form.value['fromName']
    const fromEmail = this.form.value[ 'fromEmail' ]
    const body = this.form.value[ 'body' ]

    this.instanceService.contactAdministrator(fromEmail, fromName, body)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Your message has been sent.'))
            this.hide()
          },

          err => {
            this.error = err.status === 403
              ? this.i18n('You already sent this form recently')
              : err.message
          }
        )
  }
}
