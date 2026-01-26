import { CommonModule, NgClass } from '@angular/common'
import { Component, inject, OnDestroy, OnInit } from '@angular/core'
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
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'
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
    CommonModule,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    PreviewUploadComponent,
    NgClass,
    HelpComponent,
    MarkdownTextareaComponent,
    SelectOptionsComponent,
    SelectChannelComponent,
    AlertComponent,
    PeertubeCheckboxComponent
  ]
})
export class MyVideoPlaylistUpdateComponent extends MyVideoPlaylistEdit implements OnInit, OnDestroy {
  protected formReactiveService = inject(FormReactiveService)
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private router = inject(Router)
  private route = inject(ActivatedRoute)
  private videoPlaylistService = inject(VideoPlaylistService)
  private serverService = inject(ServerService)

  error: string

  private paramsSub: Subscription

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

    this.paramsSub = this.route.params
      .pipe(
        map(routeParams => routeParams['videoPlaylistId']),
        switchMap(videoPlaylistId => {
          return forkJoin([
            this.videoPlaylistService.getVideoPlaylist(videoPlaylistId),
            this.serverService.getVideoPlaylistPrivacies(),
            listUserChannelsForSelect(this.authService, { includeCollaborations: true })
          ])
        })
      )
      .subscribe({
        next: ([ videoPlaylistToUpdate, videoPlaylistPrivacies, channels ]) => {
          this.videoPlaylistToUpdate = videoPlaylistToUpdate
          this.videoPlaylistPrivacies = videoPlaylistPrivacies
          this.userVideoChannels = channels.filter(c => c.ownerAccountId === this.videoPlaylistToUpdate.ownerAccount.id)

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

  isEditor () {
    if (!this.videoPlaylistToUpdate) return false

    return this.videoPlaylistToUpdate?.ownerAccount.id !== this.authService.getUser().account.id
  }

  getOwnerAccountDisplayName () {
    return this.videoPlaylistToUpdate?.ownerAccount.displayName
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
