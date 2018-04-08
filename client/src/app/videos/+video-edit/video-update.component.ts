import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { NotificationsService } from 'angular2-notifications'
import 'rxjs/add/observable/forkJoin'
import { VideoPrivacy } from '../../../../../shared/models/videos'
import { ServerService } from '../../core'
import { AuthService } from '../../core/auth'
import { FormReactive } from '../../shared'
import { ValidatorMessage } from '../../shared/forms/form-validators/validator-message'
import { populateAsyncUserVideoChannels } from '../../shared/misc/utils'
import { VideoEdit } from '../../shared/video/video-edit.model'
import { VideoService } from '../../shared/video/video.service'

@Component({
  selector: 'my-videos-update',
  styleUrls: [ './shared/video-edit.component.scss' ],
  templateUrl: './video-update.component.html'
})

export class VideoUpdateComponent extends FormReactive implements OnInit {
  video: VideoEdit

  isUpdatingVideo = false
  form: FormGroup
  formErrors: { [ id: string ]: string } = {}
  validationMessages: ValidatorMessage = {}
  videoPrivacies = []
  userVideoChannels = []

  constructor (
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private notificationsService: NotificationsService,
    private serverService: ServerService,
    private videoService: VideoService,
    private authService: AuthService,
    private loadingBar: LoadingBarService
  ) {
    super()
  }

  buildForm () {
    this.form = this.formBuilder.group({})
    this.form.valueChanges.subscribe(data => this.onValueChanged(data))
  }

  ngOnInit () {
    this.buildForm()

    this.serverService.videoPrivaciesLoaded
      .subscribe(() => this.videoPrivacies = this.serverService.getVideoPrivacies())

    const uuid: string = this.route.snapshot.params['uuid']
    this.videoService.getVideo(uuid)
      .switchMap(video => {
        return this.videoService
          .loadCompleteDescription(video.descriptionPath)
          .map(description => Object.assign(video, { description }))
      })
      .subscribe(
        video => {
          this.video = new VideoEdit(video)

          this.userVideoChannels = [
            {
              id: video.channel.id,
              label: video.channel.displayName
            }
          ]

          // We cannot set private a video that was not private
          if (video.privacy.id !== VideoPrivacy.PRIVATE) {
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
          this.notificationsService.error('Error', err.message)
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

    this.loadingBar.start()
    this.isUpdatingVideo = true
    this.videoService.updateVideo(this.video)
                     .subscribe(
                       () => {
                         this.isUpdatingVideo = false
                         this.loadingBar.complete()
                         this.notificationsService.success('Success', 'Video updated.')
                         this.router.navigate([ '/videos/watch', this.video.uuid ])
                       },

                       err => {
                         this.isUpdatingVideo = false
                         this.notificationsService.error('Error', err.message)
                         console.error(err)
                       }
                      )

  }

  private hydrateFormFromVideo () {
    this.form.patchValue(this.video.toJSON())

    const objects = [
      {
        url: 'thumbnailUrl',
        name: 'thumbnailfile'
      },
      {
        url: 'previewUrl',
        name: 'previewfile'
      }
    ]

    for (const obj of objects) {
      fetch(this.video[obj.url])
        .then(response => response.blob())
        .then(data => {
          this.form.patchValue({
            [ obj.name ]: data
          })
        })
    }
  }
}
