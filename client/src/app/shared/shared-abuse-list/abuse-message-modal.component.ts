import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { AuthService, Notifier, HtmlRendererService } from '@app/core'
import { AbuseValidatorsService, FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { AbuseMessage, UserAbuse } from '@shared/models'
import { AbuseService } from '../shared-moderation'

@Component({
  selector: 'my-abuse-message-modal',
  templateUrl: './abuse-message-modal.component.html',
  styleUrls: [ './abuse-message-modal.component.scss' ]
})
export class AbuseMessageModalComponent extends FormReactive implements OnInit {
  @ViewChild('modal', { static: true }) modal: NgbModal

  @Input() isAdminView: boolean

  @Output() countMessagesUpdated = new EventEmitter<{ abuseId: number, countMessages: number }>()

  abuseMessages: (AbuseMessage & { messageHtml: string })[] = []
  textareaMessage: string
  sendingMessage = false
  noResults = false

  private openedModal: NgbModalRef
  private abuse: UserAbuse

  constructor (
    protected formValidatorService: FormValidatorService,
    private abuseValidatorsService: AbuseValidatorsService,
    private modalService: NgbModal,
    private i18n: I18n,
    private htmlRenderer: HtmlRendererService,
    private auth: AuthService,
    private notifier: Notifier,
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

  getPlaceholderMessage () {
    if (this.isAdminView) {
      return this.i18n('Add a message to communicate with the reporter')
    }

    return this.i18n('Add a message to communicate with the moderation team')
  }

  private loadMessages () {
    this.abuseService.listAbuseMessages(this.abuse)
      .subscribe(
        async res => {
          this.abuseMessages = []

          for (const m of res.data) {
            this.abuseMessages.push(Object.assign(m, {
              messageHtml: await this.htmlRenderer.convertToBr(m.message)
            }))
          }

          this.noResults = this.abuseMessages.length === 0

          setTimeout(() => {
            // Don't use ViewChild: it is not supported inside a ng-template
            const messagesBlock = document.querySelector('.messages')
            messagesBlock.scroll(0, messagesBlock.scrollHeight)
          })
        },

        err => this.notifier.error(err.message)
      )
  }

}
