import { Observable } from 'rxjs'
import { getLocaleDirection } from '@angular/common'
import {
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  LOCALE_ID,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core'
import { Notifier, User } from '@app/core'
import { VIDEO_COMMENT_TEXT_VALIDATOR } from '@app/shared/form-validators/video-comment-validators'
import { FormReactive, FormReactiveService } from '@app/shared/shared-forms'
import { Video } from '@app/shared/shared-main'
import { VideoComment, VideoCommentService } from '@app/shared/shared-video-comment'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { VideoCommentCreate } from '@shared/models'

@Component({
  selector: 'my-video-comment-add',
  templateUrl: './video-comment-add.component.html',
  styleUrls: [ './video-comment-add.component.scss' ]
})
export class VideoCommentAddComponent extends FormReactive implements OnChanges, OnInit {
  @Input() user: User
  @Input() video: Video
  @Input() videoPassword: string
  @Input() parentComment?: VideoComment
  @Input() parentComments?: VideoComment[]
  @Input() focusOnInit = false
  @Input() textValue?: string

  @Output() commentCreated = new EventEmitter<VideoComment>()
  @Output() cancel = new EventEmitter()

  @ViewChild('visitorModal', { static: true }) visitorModal: NgbModal
  @ViewChild('emojiModal', { static: true }) emojiModal: NgbModal
  @ViewChild('textarea', { static: true }) textareaElement: ElementRef

  addingComment = false
  addingCommentButtonValue: string

  private emojiMarkupList: { emoji: string, name: string }[]

  constructor (
    protected formReactiveService: FormReactiveService,
    private notifier: Notifier,
    private videoCommentService: VideoCommentService,
    private modalService: NgbModal,
    @Inject(LOCALE_ID) private localeId: string
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      text: VIDEO_COMMENT_TEXT_VALIDATOR
    })

    if (this.user) {
      if (!this.parentComment) {
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

    const emojiMarkupObjectList = require('markdown-it-emoji/lib/data/light.json')

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
    if (this.user === null) { // we only open it for visitors
      // fixing ng-bootstrap ModalService and the "Expression Changed After It Has Been Checked" Error
      event.srcElement.blur()
      event.preventDefault()

      this.modalService.open(this.visitorModal)
    }
  }

  openEmojiModal (event: any) {
    event.preventDefault()
    this.modalService.open(this.emojiModal, { backdrop: true, size: 'lg' })
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

    if (this.parentComment) {
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

        this.notifier.error(err.message)
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
    this.cancel.emit(null)
    this.form.value['text'] = this.textareaElement.nativeElement.value = ''
  }

  isRTL () {
    return getLocaleDirection(this.localeId) === 'rtl'
  }

  getAvatarActorType () {
    if (this.user) return 'account'

    return 'unlogged'
  }

  private addCommentReply (commentCreate: VideoCommentCreate) {
    return this.videoCommentService
      .addCommentReply({
        videoId: this.video.uuid,
        inReplyToCommentId: this.parentComment.id,
        comment: commentCreate,
        videoPassword: this.videoPassword
      })
  }

  private addCommentThread (commentCreate: VideoCommentCreate) {
    return this.videoCommentService
      .addCommentThread(this.video.uuid, commentCreate, this.videoPassword)
  }

  private initTextValue () {
    if (this.textValue) {
      this.patchTextValue(this.textValue, this.focusOnInit)
      return
    }

    if (this.parentComment) {
      const mentions = this.parentComments
        .filter(c => c.account && c.account.id !== this.user.account.id) // Don't add mention of ourselves
        .map(c => '@' + c.by)

      const mentionsSet = new Set(mentions)
      const mentionsText = Array.from(mentionsSet).join(' ') + ' '

      this.patchTextValue(mentionsText, this.focusOnInit)
    }
  }

  private patchTextValue (text: string, focus: boolean) {
    setTimeout(() => {
      if (focus) {
        this.textareaElement.nativeElement.focus()
      }

      // Scroll to textarea
      this.textareaElement.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })

      // Use the native textarea autosize according to the text's break lines
      this.textareaElement.nativeElement.dispatchEvent(new Event('input'))
    })

    this.form.patchValue({ text })
  }
}
