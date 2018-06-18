import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { Observable } from 'rxjs'
import { VideoCommentCreate } from '../../../../../../shared/models/videos/video-comment.model'
import { FormReactive } from '../../../shared'
import { User } from '../../../shared/users'
import { Video } from '../../../shared/video/video.model'
import { VideoComment } from './video-comment.model'
import { VideoCommentService } from './video-comment.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { VideoCommentValidatorsService } from '@app/shared/forms/form-validators/video-comment-validators.service'

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

  @Output() commentCreated = new EventEmitter<VideoCommentCreate>()

  @ViewChild('textarea') private textareaElement: ElementRef

  private addingComment = false

  constructor (
    protected formValidatorService: FormValidatorService,
    private videoCommentValidatorsService: VideoCommentValidatorsService,
    private notificationsService: NotificationsService,
    private videoCommentService: VideoCommentService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      text: this.videoCommentValidatorsService.VIDEO_COMMENT_TEXT
    })

    if (this.focusOnInit === true) {
      this.textareaElement.nativeElement.focus()
    }

    if (this.parentComment) {
      const mentions = this.parentComments
        .filter(c => c.account.id !== this.user.account.id) // Don't add mention of ourselves
        .map(c => '@' + c.by)

      const mentionsSet = new Set(mentions)
      const mentionsText = Array.from(mentionsSet).join(' ') + ' '

      this.form.patchValue({ text: mentionsText })
    }
  }

  onValidKey () {
    this.onValueChanged()
    if (!this.form.valid) return

    this.formValidated()
  }

  formValidated () {
    // If we validate very quickly the comment form, we might comment twice
    if (this.addingComment) return

    this.addingComment = true

    const commentCreate: VideoCommentCreate = this.form.value
    let obs: Observable<any>

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

        this.notificationsService.error(this.i18n('Error'), err.text)
      }
    )
  }

  isAddButtonDisplayed () {
    return this.form.value['text']
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
