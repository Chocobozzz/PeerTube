import { Component, ElementRef, EventEmitter, Output, ViewChild, OnInit } from '@angular/core'
import { Notifier, AuthService } from '@app/core'
import { FormReactive, FormValidatorService, AbuseValidatorsService } from '@app/shared/shared-forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { AbuseMessage, UserAbuse } from '@shared/models'
import { AbuseService } from './abuse.service'

@Component({
  selector: 'my-abuse-message-modal',
  templateUrl: './abuse-message-modal.component.html',
  styleUrls: [ './abuse-message-modal.component.scss' ]
})
export class AbuseMessageModalComponent extends FormReactive implements OnInit {
  @ViewChild('modal', { static: true }) modal: NgbModal
  @ViewChild('messagesBlock', { static: false }) messagesBlock: ElementRef

  @Output() countMessagesUpdated = new EventEmitter<{ abuseId: number, countMessages: number }>()

  abuseMessages: AbuseMessage[] = []
  textareaMessage: string
  sendingMessage = false

  private openedModal: NgbModalRef
  private abuse: UserAbuse

  constructor (
    protected formValidatorService: FormValidatorService,
    private abuseValidatorsService: AbuseValidatorsService,
    private modalService: NgbModal,
    private auth: AuthService,
    private notifier: Notifier,
    private i18n: I18n,
    private abuseService: AbuseService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      message: this.abuseValidatorsService.ABUSE_MESSAGE
    })
  }

  openModal (abuse: UserAbuse) {
    this.abuse = abuse

    this.openedModal = this.modalService.open(this.modal, { centered: true })

    this.loadMessages()
  }

  hide () {
    this.abuseMessages = []
    this.openedModal.close()
  }

  addMessage () {
    this.sendingMessage = true

    this.abuseService.addAbuseMessage(this.abuse, this.form.value['message'])
      .subscribe(
        () => {
          this.form.reset()
          this.sendingMessage = false
          this.countMessagesUpdated.emit({ abuseId: this.abuse.id, countMessages: this.abuseMessages.length + 1 })

          this.loadMessages()
        },

        err => {
          this.sendingMessage = false
          console.error(err)
          this.notifier.error('Sorry but you cannot send this message. Please retry later')
        }
      )
  }

  deleteMessage (abuseMessage: AbuseMessage) {
    this.abuseService.deleteAbuseMessage(this.abuse, abuseMessage)
      .subscribe(
        () => {
          this.countMessagesUpdated.emit({ abuseId: this.abuse.id, countMessages: this.abuseMessages.length - 1 })

          this.abuseMessages = this.abuseMessages.filter(m => m.id !== abuseMessage.id)
        },

        err => this.notifier.error(err.message)
      )
  }

  isMessageByMe (abuseMessage: AbuseMessage) {
    return this.auth.getUser().account.id === abuseMessage.account.id
  }

  private loadMessages () {
    this.abuseService.listAbuseMessages(this.abuse)
      .subscribe(
        res => {
          this.abuseMessages = res.data

          setTimeout(() => {
            if (!this.messagesBlock) return

            const element = this.messagesBlock.nativeElement as HTMLElement
            element.scrollIntoView({ block: 'end', inline: 'nearest' })
          })
        },

        err => this.notifier.error(err.message)
      )
  }

}
