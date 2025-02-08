import { NgClass, NgIf } from '@angular/common'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { AuthService, Notifier, ServerService } from '@app/core'
import { listUserChannelsForSelect } from '@app/helpers'
import {
  setPlaylistChannelValidator,
  VIDEO_PLAYLIST_CHANNEL_ID_VALIDATOR,
  VIDEO_PLAYLIST_DESCRIPTION_VALIDATOR,
  VIDEO_PLAYLIST_DISPLAY_NAME_VALIDATOR,
  VIDEO_PLAYLIST_PRIVACY_VALIDATOR
} from '@app/shared/form-validators/video-playlist-validators'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { VideoPlaylistUpdate } from '@peertube/peertube-models'
import { forkJoin, Subscription } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { MarkdownTextareaComponent } from '../../shared/shared-forms/markdown-textarea.component'
import { PreviewUploadComponent } from '../../shared/shared-forms/preview-upload.component'
import { SelectChannelComponent } from '../../shared/shared-forms/select/select-channel.component'
import { SelectOptionsComponent } from '../../shared/shared-forms/select/select-options.component'
import { HelpComponent } from '../../shared/shared-main/buttons/help.component'
import { MyVideoPlaylistEdit } from './my-video-playlist-edit'

@Component({
  templateUrl: './my-video-playlist-edit.component.html',
  styleUrls: [ './my-video-playlist-edit.component.scss' ],
  imports: [
    NgIf,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    PreviewUploadComponent,
    NgClass,
    HelpComponent,
    MarkdownTextareaComponent,
    SelectOptionsComponent,
    SelectChannelComponent,
    AlertComponent
  ]
})
export class MyVideoPlaylistUpdateComponent extends MyVideoPlaylistEdit implements OnInit, OnDestroy {
  error: string

  private paramsSub: Subscription

  constructor (
    protected formReactiveService: FormReactiveService,
    private authService: AuthService,
    private notifier: Notifier,
    private router: Router,
    private route: ActivatedRoute,
    private videoPlaylistService: VideoPlaylistService,
    private serverService: ServerService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      displayName: VIDEO_PLAYLIST_DISPLAY_NAME_VALIDATOR,
      privacy: VIDEO_PLAYLIST_PRIVACY_VALIDATOR,
      description: VIDEO_PLAYLIST_DESCRIPTION_VALIDATOR,
      videoChannelId: VIDEO_PLAYLIST_CHANNEL_ID_VALIDATOR,
      thumbnailfile: null
    })

    this.form.get('privacy').valueChanges.subscribe(privacy => {
      setPlaylistChannelValidator(this.form.get('videoChannelId'), privacy)
    })

    listUserChannelsForSelect(this.authService)
      .subscribe(channels => this.userVideoChannels = channels)

    this.paramsSub = this.route.params
                         .pipe(
                           map(routeParams => routeParams['videoPlaylistId']),
                           switchMap(videoPlaylistId => {
                             return forkJoin([
                               this.videoPlaylistService.getVideoPlaylist(videoPlaylistId),
                               this.serverService.getVideoPlaylistPrivacies()
                             ])
                           })
                         )
                         .subscribe({
                           next: ([ videoPlaylistToUpdate, videoPlaylistPrivacies ]) => {
                             this.videoPlaylistToUpdate = videoPlaylistToUpdate
                             this.videoPlaylistPrivacies = videoPlaylistPrivacies

                             this.hydrateFormFromPlaylist()
                           },

                           error: err => {
                             this.error = err.message
                           }
                         })
  }

  ngOnDestroy () {
    if (this.paramsSub) this.paramsSub.unsubscribe()
  }

  formValidated () {
    this.error = undefined

    const body = this.form.value
    const videoPlaylistUpdate: VideoPlaylistUpdate = {
      displayName: body.displayName,
      privacy: body.privacy,
      description: body.description || null,
      videoChannelId: body.videoChannelId || null,
      thumbnailfile: body.thumbnailfile || undefined
    }

    this.videoPlaylistService.updateVideoPlaylist(this.videoPlaylistToUpdate, videoPlaylistUpdate)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Playlist ${videoPlaylistUpdate.displayName} updated.`)
          this.router.navigate([ '/my-library', 'video-playlists' ])
        },

        error: err => {
          this.error = err.message
        }
      })
  }

  isCreation () {
    return false
  }

  getFormButtonTitle () {
    return $localize`Update`
  }

  private hydrateFormFromPlaylist () {
    this.form.patchValue({
      displayName: this.videoPlaylistToUpdate.displayName,
      privacy: this.videoPlaylistToUpdate.privacy.id,
      description: this.videoPlaylistToUpdate.description,
      videoChannelId: this.videoPlaylistToUpdate.videoChannel ? this.videoPlaylistToUpdate.videoChannel.id : null
    })

    fetch(this.videoPlaylistToUpdate.thumbnailUrl)
      .then(response => response.blob())
      .then(data => {
        this.form.patchValue({
          thumbnailfile: data
        })
      })
  }
}
