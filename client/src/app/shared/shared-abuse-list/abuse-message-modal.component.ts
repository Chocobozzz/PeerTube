import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { AuthService, HtmlRendererService, Notifier } from '@app/core'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { AbuseMessage, UserAbuse } from '@shared/models'
import { ABUSE_MESSAGE_VALIDATOR } from '../form-validators/abuse-validators'
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
    private modalService: NgbModal,
    private htmlRenderer: HtmlRendererService,
    private auth: AuthService,
    private notifier: Notifier,
    private abuseService: AbuseService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      message: ABUSE_MESSAGE_VALIDATOR
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
      .subscribe({
        next: () => {
          this.form.reset()
          this.sendingMessage = false
          this.countMessagesUpdated.emit({ abuseId: this.abuse.id, countMessages: this.abuseMessages.length + 1 })

          this.loadMessages()
        },

        error: err => {
          this.sendingMessage = false
          console.error(err)
          this.notifier.error('Sorry but you cannot send this message. Please retry later')
        }
      })
  }

  deleteMessage (abuseMessage: AbuseMessage) {
    this.abuseService.deleteAbuseMessage(this.abuse, abuseMessage)
      .subscribe({
        next: () => {
          this.countMessagesUpdated.emit({ abuseId: this.abuse.id, countMessages: this.abuseMessages.length - 1 })

          this.abuseMessages = this.abuseMessages.filter(m => m.id !== abuseMessage.id)
        },

        error: err => this.notifier.error(err.message)
      })
  }

  isMessageByMe (abuseMessage: AbuseMessage) {
    return this.auth.getUser().account.id === abuseMessage.account.id
  }

  getPlaceholderMessage () {
    if (this.isAdminView) {
      return $localize`Add a message to communicate with the reporter`
    }

    return $localize`Add a message to communicate with the moderation team`
  }

  private loadMessages () {
    this.abuseService.listAbuseMessages(this.abuse)
      .subscribe({
        next: async res => {
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

        error: err => this.notifier.error(err.message)
      })
  }

}
