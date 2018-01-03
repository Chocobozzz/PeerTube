import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { NotificationsService } from 'angular2-notifications'
import { Observable } from 'rxjs/Observable'
import { VideoCommentCreate } from '../../../../../../shared/models/videos/video-comment.model'
import { FormReactive } from '../../../shared'
import { VIDEO_COMMENT_TEXT } from '../../../shared/forms/form-validators/video-comment'
import { User } from '../../../shared/users'
import { Video } from '../../../shared/video/video.model'
import { VideoComment } from './video-comment.model'
import { VideoCommentService } from './video-comment.service'

@Component({
  selector: 'my-video-comment-add',
  templateUrl: './video-comment-add.component.html',
  styleUrls: ['./video-comment-add.component.scss']
})
export class VideoCommentAddComponent extends FormReactive implements OnInit {
  @Input() user: User
  @Input() video: Video
  @Input() parentComment: VideoComment
  @Input() focusOnInit = false

  @Output() commentCreated = new EventEmitter<VideoCommentCreate>()

  form: FormGroup
  formErrors = {
    'text': ''
  }
  validationMessages = {
    'text': VIDEO_COMMENT_TEXT.MESSAGES
  }

  @ViewChild('textarea') private textareaElement: ElementRef

  constructor (
    private formBuilder: FormBuilder,
    private notificationsService: NotificationsService,
    private videoCommentService: VideoCommentService
  ) {
    super()
  }

  buildForm () {
    this.form = this.formBuilder.group({
      text: [ '', VIDEO_COMMENT_TEXT.VALIDATORS ]
    })

    this.form.valueChanges.subscribe(data => this.onValueChanged(data))
  }

  ngOnInit () {
    this.buildForm()

    if (this.focusOnInit === true) {
      this.textareaElement.nativeElement.focus()
    }
  }

  formValidated () {
    const commentCreate: VideoCommentCreate = this.form.value
    let obs: Observable<any>

    if (this.parentComment) {
      obs = this.addCommentReply(commentCreate)
    } else {
      obs = this.addCommentThread(commentCreate)
    }

    obs.subscribe(
      comment => {
        this.commentCreated.emit(comment)
        this.form.reset()
      },

      err => this.notificationsService.error('Error', err.text)
    )
  }

  isAddButtonDisplayed () {
    return this.form.value['text']
  }

  getUserAvatarUrl () {
    return this.user.getAvatarUrl()
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
