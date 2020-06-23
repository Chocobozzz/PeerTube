import { Component, OnInit, ViewChild } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { FormReactive, FormValidatorService, InstanceValidatorsService } from '@app/shared/shared-forms'
import { InstanceService } from '@app/shared/shared-instance'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ServerConfig } from '@shared/models'

@Component({
  selector: 'my-contact-admin-modal',
  templateUrl: './contact-admin-modal.component.html',
  styleUrls: [ './contact-admin-modal.component.scss' ]
})
export class ContactAdminModalComponent extends FormReactive implements OnInit {
  @ViewChild('modal', { static: true }) modal: NgbModal

  error: string

  private openedModal: NgbModalRef
  private serverConfig: ServerConfig

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
    return this.serverConfig.instance.name
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)

    this.buildForm({
      fromName: this.instanceValidatorsService.FROM_NAME,
      fromEmail: this.instanceValidatorsService.FROM_EMAIL,
      subject: this.instanceValidatorsService.SUBJECT,
      body: this.instanceValidatorsService.BODY
    })
  }

  show () {
    this.openedModal = this.modalService.open(this.modal, { centered: true, keyboard: false })
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
    const subject = this.form.value[ 'subject' ]
    const body = this.form.value[ 'body' ]

    this.instanceService.contactAdministrator(fromEmail, fromName, subject, body)
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
