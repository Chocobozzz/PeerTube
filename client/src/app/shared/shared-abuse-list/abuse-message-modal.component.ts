import { NgClass } from '@angular/common'
import { Component, OnInit, inject, input, output, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { AuthService, HtmlRendererService, Notifier } from '@app/core'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { AbuseMessage, UserAbuse } from '@peertube/peertube-models'
import { ABUSE_MESSAGE_VALIDATOR } from '../form-validators/abuse-validators'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { PTDatePipe } from '../shared-main/common/date.pipe'
import { AbuseService } from '../shared-moderation/abuse.service'

@Component({
  selector: 'my-abuse-message-modal',
  templateUrl: './abuse-message-modal.component.html',
  styleUrls: [ './abuse-message-modal.component.scss' ],
  imports: [ GlobalIconComponent, NgClass, FormsModule, ReactiveFormsModule, PTDatePipe ]
})
export class AbuseMessageModalComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private modalService = inject(NgbModal)
  private htmlRenderer = inject(HtmlRendererService)
  private auth = inject(AuthService)
  private notifier = inject(Notifier)
  private abuseService = inject(AbuseService)

  readonly modal = viewChild<NgbModal>('modal')

  readonly isAdminView = input<boolean>(undefined)

  readonly countMessagesUpdated = output<{
    abuseId: number
    countMessages: number
  }>()

  abuseMessages: (AbuseMessage & { messageHtml: string })[] = []
  textareaMessage: string
  sendingMessage = false
  noResults = false

  private openedModal: NgbModalRef
  private abuse: UserAbuse

  ngOnInit () {
    this.buildForm({
      message: ABUSE_MESSAGE_VALIDATOR
    })
  }

  openModal (abuse: UserAbuse) {
    this.abuse = abuse

    this.openedModal = this.modalService.open(this.modal(), { centered: true })

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
          this.notifier.handleError(err)
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

        error: err => this.notifier.handleError(err)
      })
  }

  isMessageByMe (abuseMessage: AbuseMessage) {
    return this.auth.getUser().account.id === abuseMessage.account.id
  }

  getPlaceholderMessage () {
    if (this.isAdminView()) {
      return $localize`Add a message to communicate with the reporter`
    }

    return $localize`Add a message to communicate with the moderation team`
  }

  private loadMessages () {
    this.abuseService.listAbuseMessages(this.abuse)
      .subscribe({
        next: res => {
          this.abuseMessages = []

          for (const m of res.data) {
            this.abuseMessages.push(Object.assign(m, {
              messageHtml: this.htmlRenderer.convertToBr(m.message)
            }))
          }

          this.noResults = this.abuseMessages.length === 0

          setTimeout(() => {
            // Don't use ViewChild: it is not supported inside a ng-template
            const messagesBlock = document.querySelector('.messages')
            messagesBlock.scroll(0, messagesBlock.scrollHeight)
          })
        },

        error: err => this.notifier.handleError(err)
      })
  }
}
