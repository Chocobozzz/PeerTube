import { Observable } from 'rxjs'
import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { Router } from '@angular/router'
import { Notifier, User } from '@app/core'
import { FormReactive, FormValidatorService, VideoCommentValidatorsService } from '@app/shared/shared-forms'
import { Video } from '@app/shared/shared-main'
import { VideoComment, VideoCommentService } from '@app/shared/shared-video-comment'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { VideoCommentCreate } from '@shared/models'

@Component({
  selector: 'my-video-comment-add',
  templateUrl: './video-comment-add.component.html',
  styleUrls: ['./video-comment-add.component.scss']
})
export class VideoCommentAddComponent extends FormReactive implements OnInit {
  @Input() user: User
  @Input() video: Video
  @Input() parentComment: VideoComment
  @Input() parentComments: VideoComment[]
  @Input() focusOnInit = false

  @Output() commentCreated = new EventEmitter<VideoComment>()
  @Output() cancel = new EventEmitter()

  @ViewChild('visitorModal', { static: true }) visitorModal: NgbModal
  @ViewChild('textarea', { static: true }) textareaElement: ElementRef

  addingComment = false

  constructor (
    protected formValidatorService: FormValidatorService,
    private videoCommentValidatorsService: VideoCommentValidatorsService,
    private notifier: Notifier,
    private videoCommentService: VideoCommentService,
    private modalService: NgbModal,
    private router: Router
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      text: this.videoCommentValidatorsService.VIDEO_COMMENT_TEXT
    })

    if (this.user) {
      if (this.focusOnInit === true) {
        this.textareaElement.nativeElement.focus()
      }

      if (this.parentComment) {
        const mentions = this.parentComments
          .filter(c => c.account && c.account.id !== this.user.account.id) // Don't add mention of ourselves
          .map(c => '@' + c.by)

        const mentionsSet = new Set(mentions)
        const mentionsText = Array.from(mentionsSet).join(' ') + ' '

        this.form.patchValue({ text: mentionsText })
      }
    }
  }

  onValidKey () {
    this.check()
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

  hideVisitorModal () {
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

    obs.subscribe(
      comment => {
        this.addingComment = false
        this.commentCreated.emit(comment)
        this.form.reset()
      },

      err => {
        this.addingComment = false

        this.notifier.error(err.text)
      }
    )
  }

  isAddButtonDisplayed () {
    return this.form.value['text']
  }

  getUri () {
    return window.location.href
  }

  getAvatarUrl () {
    if (this.user) return this.user.accountAvatarUrl
    return window.location.origin + '/client/assets/images/default-avatar.png'
  }

  gotoLogin () {
    this.hideVisitorModal()
    this.router.navigate([ '/login' ])
  }

  cancelCommentReply () {
    this.cancel.emit(null)
    this.form.value['text'] = this.textareaElement.nativeElement.value = ''
  }

  private addCommentReply (commentCreate: VideoCommentCreate) {
    return this.videoCommentService
      .addCommentReply(this.video.id, this.parentComment.id, commentCreate)
  }

  private addCommentThread (commentCreate: VideoCommentCreate) {
    return this.videoCommentService
      .addCommentThread(this.video.id, commentCreate)
  }
}
