import { Component, Input, OnInit } from '@angular/core'
import { FormBuilder, FormControl, FormGroup } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { NotificationsService } from 'angular2-notifications'
import { ServerService } from 'app/core'
import { VideoEdit } from 'app/shared/video/video-edit.model'
import 'rxjs/add/observable/forkJoin'
import { VideoPrivacy } from '../../../../../shared/models/videos/video-privacy.enum'
import {
  ValidatorMessage,
  VIDEO_CATEGORY,
  VIDEO_DESCRIPTION,
  VIDEO_LANGUAGE,
  VIDEO_LICENCE,
  VIDEO_NAME,
  VIDEO_PRIVACY,
  VIDEO_TAGS
} from '../../../shared/forms/form-validators'

@Component({
  selector: 'my-video-edit',
  styleUrls: [ './video-edit.component.scss' ],
  templateUrl: './video-edit.component.html'
})

export class VideoEditComponent implements OnInit {
  @Input() form: FormGroup
  @Input() formErrors: { [ id: string ]: string } = {}
  @Input() validationMessages: ValidatorMessage = {}
  @Input() videoPrivacies = []

  tags: string[] = []
  videoCategories = []
  videoLicences = []
  videoLanguages = []
  video: VideoEdit

  tagValidators = VIDEO_TAGS.VALIDATORS
  tagValidatorsMessages = VIDEO_TAGS.MESSAGES

  error: string = null

  constructor (
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private notificationsService: NotificationsService,
    private serverService: ServerService
  ) { }

  updateForm () {
    this.formErrors['name'] = ''
    this.formErrors['privacy'] = ''
    this.formErrors['category'] = ''
    this.formErrors['licence'] = ''
    this.formErrors['language'] = ''
    this.formErrors['description'] = ''

    this.validationMessages['name'] = VIDEO_NAME.MESSAGES
    this.validationMessages['privacy'] = VIDEO_PRIVACY.MESSAGES
    this.validationMessages['category'] = VIDEO_CATEGORY.MESSAGES
    this.validationMessages['licence'] = VIDEO_LICENCE.MESSAGES
    this.validationMessages['language'] = VIDEO_LANGUAGE.MESSAGES
    this.validationMessages['description'] = VIDEO_DESCRIPTION.MESSAGES

    this.form.addControl('name', new FormControl('', VIDEO_NAME.VALIDATORS))
    this.form.addControl('privacy', new FormControl('', VIDEO_PRIVACY.VALIDATORS))
    this.form.addControl('nsfw', new FormControl(false))
    this.form.addControl('category', new FormControl('', VIDEO_CATEGORY.VALIDATORS))
    this.form.addControl('licence', new FormControl('', VIDEO_LICENCE.VALIDATORS))
    this.form.addControl('language', new FormControl('', VIDEO_LANGUAGE.VALIDATORS))
    this.form.addControl('description', new FormControl('', VIDEO_DESCRIPTION.VALIDATORS))
    this.form.addControl('tags', new FormControl(''))
  }

  ngOnInit () {
    this.updateForm()

    this.videoCategories = this.serverService.getVideoCategories()
    this.videoLicences = this.serverService.getVideoLicences()
    this.videoLanguages = this.serverService.getVideoLanguages()
  }
}
