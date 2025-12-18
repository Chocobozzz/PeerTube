import { getLocaleDirection, NgClass } from '@angular/common'
import { Component, ElementRef, inject, input, LOCALE_ID, OnChanges, OnInit, output, SimpleChanges, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier, User } from '@app/core'
import { VIDEO_COMMENT_TEXT_VALIDATOR } from '@app/shared/form-validators/video-comment-validators'
import { ActorAvatarComponent } from '@app/shared/shared-actor-image/actor-avatar.component'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { TextareaAutoResizeDirective } from '@app/shared/shared-forms/textarea-autoresize.directive'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { HelpComponent } from '@app/shared/shared-main/buttons/help.component'
import { LoginLinkComponent } from '@app/shared/shared-main/users/login-link.component'
import { Video } from '@app/shared/shared-main/video/video.model'
import { RemoteSubscribeComponent } from '@app/shared/shared-user-subscription/remote-subscribe.component'
import { VideoComment } from '@app/shared/shared-video-comment/video-comment.model'
import { VideoCommentService } from '@app/shared/shared-video-comment/video-comment.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { VideoCommentCreate } from '@peertube/peertube-models'
import { Observable } from 'rxjs'

@Component({
  selector: 'my-video-comment-add',
  templateUrl: './video-comment-add.component.html',
  styleUrls: [ './video-comment-add.component.scss' ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ActorAvatarComponent,
    TextareaAutoResizeDirective,
    NgClass,
    HelpComponent,
    GlobalIconComponent,
    RemoteSubscribeComponent,
    LoginLinkComponent
  ]
})
export class VideoCommentAddComponent extends FormReactive implements OnChanges, OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private notifier = inject(Notifier)
  private videoCommentService = inject(VideoCommentService)
  private modalService = inject(NgbModal)
  private localeId = inject(LOCALE_ID)

  readonly user = input<User>(undefined)
  readonly video = input<Video>(undefined)
  readonly videoPassword = input<string>(undefined)
  readonly parentComment = input<VideoComment>(undefined)
  readonly parentComments = input<VideoComment[]>(undefined)
  readonly focusOnInit = input(false)
  readonly textValue = input<string>(undefined)

  readonly commentCreated = output<VideoComment>()
  readonly cancelEdit = output()

  readonly visitorModal = viewChild<NgbModal>('visitorModal')
  readonly emojiModal = viewChild<NgbModal>('emojiModal')
  readonly textareaElement = viewChild<ElementRef>('textarea')

  addingComment = false
  addingCommentButtonValue: string

  private emojiMarkupList: { emoji: string, name: string }[]

  ngOnInit () {
    this.buildForm({
      text: VIDEO_COMMENT_TEXT_VALIDATOR
    })

    if (this.user()) {
      if (!this.parentComment()) {
        this.addingCommentButtonValue = $localize`Comment`
      } else {
        this.addingCommentButtonValue = $localize`Reply`
      }

      this.initTextValue()
    }
  }

  ngOnChanges (changes: SimpleChanges) {
    // Not initialized yet
    if (!this.form) return

    if (changes.textValue?.currentValue && changes.textValue.currentValue !== changes.textValue.previousValue) {
      this.patchTextValue(changes.textValue.currentValue, true)
    }
  }

  getEmojiMarkupList () {
    if (this.emojiMarkupList) return this.emojiMarkupList

    const emojiMarkupObjectList = require('markdown-it-emoji/lib/data/light.mjs').default

    this.emojiMarkupList = []
    for (const name of Object.keys(emojiMarkupObjectList)) {
      const emoji = emojiMarkupObjectList[name]
      this.emojiMarkupList.push({ emoji, name })
    }

    return this.emojiMarkupList
  }

  onValidKey () {
    this.forceCheck()
    if (!this.form.valid) return

    this.formValidated()
  }

  openVisitorModal (event: any) {
    if (this.user() === null) { // we only open it for visitors
      // fixing ng-bootstrap ModalService and the "Expression Changed After It Has Been Checked" Error
      event.srcElement.blur()
      event.preventDefault()

      this.modalService.open(this.visitorModal())
    }
  }

  openEmojiModal (event: any) {
    event.preventDefault()
    this.modalService.open(this.emojiModal(), { backdrop: true, size: 'lg' })
  }

  hideModals () {
    this.modalService.dismissAll()
  }

  formValidated () {
    // If we validate very quickly the comment form, we might comment twice
    if (this.addingComment) return

    this.addingComment = true

    const commentCreate: VideoCommentCreate = this.form.value
    let obs: Observable<VideoComment>

    if (this.parentComment()) {
      obs = this.addCommentReply(commentCreate)
    } else {
      obs = this.addCommentThread(commentCreate)
    }

    obs.subscribe({
      next: comment => {
        this.addingComment = false
        this.commentCreated.emit(comment)
        this.form.reset()
      },

      error: err => {
        this.addingComment = false

        this.notifier.handleError(err)
      }
    })
  }

  isAddButtonDisplayed () {
    return this.form.value['text']
  }

  getUri () {
    return window.location.href
  }

  cancelCommentReply () {
    this.cancelEdit.emit(null)
    this.form.value['text'] = ''
    this.textareaElement().nativeElement.value = ''
  }

  isRTL () {
    return getLocaleDirection(this.localeId) === 'rtl'
  }

  getAvatarActorType () {
    if (this.user()) return 'account'

    return 'unlogged'
  }

  private addCommentReply (commentCreate: VideoCommentCreate) {
    return this.videoCommentService
      .addCommentReply({
        videoId: this.video().uuid,
        inReplyToCommentId: this.parentComment().id,
        comment: commentCreate,
        videoPassword: this.videoPassword()
      })
  }

  private addCommentThread (commentCreate: VideoCommentCreate) {
    return this.videoCommentService
      .addCommentThread(this.video().uuid, commentCreate, this.videoPassword())
  }

  private initTextValue () {
    const textValue = this.textValue()
    if (textValue) {
      this.patchTextValue(textValue, this.focusOnInit())
      return
    }

    if (this.parentComment()) {
      const mentions = this.parentComments()
        .filter(c => c.account && c.account.id !== this.user().account.id) // Don't add mention of ourselves
        .map(c => '@' + c.by)

      const mentionsSet = new Set(mentions)
      const mentionsText = Array.from(mentionsSet).join(' ') + ' '

      this.patchTextValue(mentionsText, this.focusOnInit())
    }
  }

  private patchTextValue (text: string, focus: boolean) {
    setTimeout(() => {
      if (focus) {
        this.textareaElement().nativeElement.focus()
      }

      // Scroll to textarea
      this.textareaElement().nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })

      // Use the native textarea autosize according to the text's break lines
      this.textareaElement().nativeElement.dispatchEvent(new Event('input'))
    })

    this.form.patchValue({ text })
  }
}
