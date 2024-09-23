import { NgClass, NgIf } from '@angular/common'
import { Component, OnInit, ViewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { Notifier, ServerService } from '@app/core'
import {
  BODY_VALIDATOR,
  FROM_EMAIL_VALIDATOR,
  FROM_NAME_VALIDATOR,
  SUBJECT_VALIDATOR
} from '@app/shared/form-validators/instance-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { InstanceService } from '@app/shared/shared-main/instance/instance.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { HTMLServerConfig, HttpStatusCode } from '@peertube/peertube-models'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'

type Prefill = {
  subject?: string
  body?: string
}

@Component({
  selector: 'my-contact-admin-modal',
  templateUrl: './contact-admin-modal.component.html',
  styleUrls: [ './contact-admin-modal.component.scss' ],
  standalone: true,
  imports: [ GlobalIconComponent, NgIf, FormsModule, ReactiveFormsModule, NgClass, AlertComponent ]
})
export class ContactAdminModalComponent extends FormReactive implements OnInit {
  @ViewChild('modal', { static: true }) modal: NgbModal

  error: string

  private openedModal: NgbModalRef
  private serverConfig: HTMLServerConfig

  constructor (
    protected formReactiveService: FormReactiveService,
    private router: Router,
    private modalService: NgbModal,
    private instanceService: InstanceService,
    private serverService: ServerService,
    private notifier: Notifier
  ) {
    super()
  }

  get instanceName () {
    return this.serverConfig.instance.name
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.buildForm({
      fromName: FROM_NAME_VALIDATOR,
      fromEmail: FROM_EMAIL_VALIDATOR,
      subject: SUBJECT_VALIDATOR,
      body: BODY_VALIDATOR
    })
  }

  isContactFormEnabled () {
    return this.serverConfig.email.enabled && this.serverConfig.contactForm.enabled
  }

  show (prefill: Prefill = {}) {
    this.openedModal = this.modalService.open(this.modal, { centered: true, keyboard: false })

    this.openedModal.shown.subscribe(() => this.prefillForm(prefill))
    this.openedModal.result.finally(() => this.router.navigateByUrl('/about/instance'))
  }

  hide () {
    this.form.reset()
    this.error = undefined

    this.openedModal.close()
    this.openedModal = null
  }

  sendForm () {
    const fromName = this.form.value['fromName']
    const fromEmail = this.form.value['fromEmail']
    const subject = this.form.value['subject']
    const body = this.form.value['body']

    this.instanceService.contactAdministrator(fromEmail, fromName, subject, body)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Your message has been sent.`)
            this.hide()
          },

          error: err => {
            this.error = err.status === HttpStatusCode.FORBIDDEN_403
              ? $localize`You already sent this form recently`
              : err.message
          }
        })
  }

  private prefillForm (prefill: Prefill) {
    if (prefill.subject) {
      this.form.get('subject').setValue(prefill.subject)
    }

    if (prefill.body) {
      this.form.get('body').setValue(prefill.body)
    }
  }
}
