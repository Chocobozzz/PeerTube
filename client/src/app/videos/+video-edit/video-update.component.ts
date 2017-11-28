import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import 'rxjs/add/observable/forkJoin'

import { NotificationsService } from 'angular2-notifications'

import { ServerService } from '../../core'
import {
  FormReactive,
  VIDEO_NAME,
  VIDEO_CATEGORY,
  VIDEO_LICENCE,
  VIDEO_LANGUAGE,
  VIDEO_DESCRIPTION,
  VIDEO_TAGS,
  VIDEO_PRIVACY
} from '../../shared'
import { VideoEdit, VideoService } from '../shared'
import { VideoPrivacy } from '../../../../../shared/models/videos/video-privacy.enum'

@Component({
  selector: 'my-videos-update',
  styleUrls: [ './shared/video-edit.component.scss' ],
  templateUrl: './video-update.component.html'
})

export class VideoUpdateComponent extends FormReactive implements OnInit {
  tags: string[] = []
  videoCategories = []
  videoLicences = []
  videoLanguages = []
  videoPrivacies = []
  video: VideoEdit

  tagValidators = VIDEO_TAGS.VALIDATORS
  tagValidatorsMessages = VIDEO_TAGS.MESSAGES

  error: string = null
  form: FormGroup
  formErrors = {
    name: '',
    privacy: '',
    category: '',
    licence: '',
    language: '',
    description: ''
  }
  validationMessages = {
    name: VIDEO_NAME.MESSAGES,
    privacy: VIDEO_PRIVACY.MESSAGES,
    category: VIDEO_CATEGORY.MESSAGES,
    licence: VIDEO_LICENCE.MESSAGES,
    language: VIDEO_LANGUAGE.MESSAGES,
    description: VIDEO_DESCRIPTION.MESSAGES
  }

  fileError = ''

  constructor (
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private notificationsService: NotificationsService,
    private serverService: ServerService,
    private videoService: VideoService
  ) {
    super()
  }

  buildForm () {
    this.form = this.formBuilder.group({
      name: [ '', VIDEO_NAME.VALIDATORS ],
      privacy: [ '', VIDEO_PRIVACY.VALIDATORS ],
      nsfw: [ false ],
      category: [ '', VIDEO_CATEGORY.VALIDATORS ],
      licence: [ '', VIDEO_LICENCE.VALIDATORS ],
      language: [ '', VIDEO_LANGUAGE.VALIDATORS ],
      description: [ '', VIDEO_DESCRIPTION.VALIDATORS ],
      tags: [ '' ]
    })

    this.form.valueChanges.subscribe(data => this.onValueChanged(data))
  }

  ngOnInit () {
    this.buildForm()

    this.videoCategories = this.serverService.getVideoCategories()
    this.videoLicences = this.serverService.getVideoLicences()
    this.videoLanguages = this.serverService.getVideoLanguages()
    this.videoPrivacies = this.serverService.getVideoPrivacies()

    const uuid: string = this.route.snapshot.params['uuid']

    this.videoService.getVideo(uuid)
      .switchMap(video => {
        return this.videoService
          .loadCompleteDescription(video.descriptionPath)
          .do(description => video.description = description)
          .map(() => video)
      })
      .subscribe(
        video => {
          this.video = new VideoEdit(video)

          // We cannot set private a video that was not private anymore
          if (video.privacy !== VideoPrivacy.PRIVATE) {
            const newVideoPrivacies = []
            for (const p of this.videoPrivacies) {
              if (p.id !== VideoPrivacy.PRIVATE) newVideoPrivacies.push(p)
            }

            this.videoPrivacies = newVideoPrivacies
          }

          this.hydrateFormFromVideo()
        },

        err => {
          console.error(err)
          this.error = 'Cannot fetch video.'
        }
      )
  }

  checkForm () {
    this.forceCheck()

    return this.form.valid
  }

  update () {
    if (this.checkForm() === false) {
      return
    }

    this.video.patch(this.form.value)

    this.videoService.updateVideo(this.video)
                     .subscribe(
                       () => {
                         this.notificationsService.success('Success', 'Video updated.')
                         this.router.navigate([ '/videos/watch', this.video.uuid ])
                       },

                       err => {
                         this.error = 'Cannot update the video.'
                         console.error(err)
                       }
                      )

  }

  private hydrateFormFromVideo () {
    this.form.patchValue(this.video.toJSON())
  }
}
