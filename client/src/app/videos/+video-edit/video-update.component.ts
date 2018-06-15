import { map, switchMap } from 'rxjs/operators'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { NotificationsService } from 'angular2-notifications'
import { VideoPrivacy } from '../../../../../shared/models/videos'
import { ServerService } from '../../core'
import { AuthService } from '../../core/auth'
import { FormReactive } from '../../shared'
import { VideoEdit } from '../../shared/video/video-edit.model'
import { VideoService } from '../../shared/video/video.service'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'

@Component({
  selector: 'my-videos-update',
  styleUrls: [ './shared/video-edit.component.scss' ],
  templateUrl: './video-update.component.html'
})
export class VideoUpdateComponent extends FormReactive implements OnInit {
  video: VideoEdit

  isUpdatingVideo = false
  videoPrivacies = []
  userVideoChannels = []
  schedulePublicationPossible = false

  constructor (
    protected formValidatorService: FormValidatorService,
    private route: ActivatedRoute,
    private router: Router,
    private notificationsService: NotificationsService,
    private serverService: ServerService,
    private videoService: VideoService,
    private authService: AuthService,
    private loadingBar: LoadingBarService,
    private videoChannelService: VideoChannelService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({})

    this.serverService.videoPrivaciesLoaded
      .subscribe(() => this.videoPrivacies = this.serverService.getVideoPrivacies())

    const uuid: string = this.route.snapshot.params[ 'uuid' ]
    this.videoService.getVideo(uuid)
        .pipe(
          switchMap(video => {
            return this.videoService
                       .loadCompleteDescription(video.descriptionPath)
                       .pipe(map(description => Object.assign(video, { description })))
          }),
          switchMap(video => {
            return this.videoChannelService
                       .listAccountVideoChannels(video.account)
                       .pipe(
                         map(result => result.data),
                         map(videoChannels => videoChannels.map(c => ({ id: c.id, label: c.displayName, support: c.support }))),
                         map(videoChannels => ({ video, videoChannels }))
                       )
          })
        )
        .subscribe(
          ({ video, videoChannels }) => {
            this.video = new VideoEdit(video)
            this.userVideoChannels = videoChannels

            // We cannot set private a video that was not private
            if (this.video.privacy !== VideoPrivacy.PRIVATE) {
              this.videoPrivacies = this.videoPrivacies.filter(p => p.id !== VideoPrivacy.PRIVATE)
            } else { // We can schedule video publication only if it it is private
              this.schedulePublicationPossible = this.video.privacy === VideoPrivacy.PRIVATE
            }

            this.hydrateFormFromVideo()
          },

          err => {
            console.error(err)
            this.notificationsService.error(this.i18n('Error'), err.message)
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
                         this.notificationsService.success(this.i18n('Success'), this.i18n('Video updated.'))
                         this.router.navigate([ '/videos/watch', this.video.uuid ])
                       },

                       err => {
                         this.isUpdatingVideo = false
                         this.notificationsService.error(this.i18n('Error'), err.message)
                         console.error(err)
                       }
                      )

  }

  private hydrateFormFromVideo () {
    this.form.patchValue(this.video.toFormPatch())

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
