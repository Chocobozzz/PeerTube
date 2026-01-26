import { CommonModule, NgClass } from '@angular/common'
import { Component, inject, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
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
import { VideoPlaylistCreate, VideoPlaylistPrivacy } from '@peertube/peertube-models'
import { of, switchMap } from 'rxjs'
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
export class MyVideoPlaylistCreateComponent extends MyVideoPlaylistEdit implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private router = inject(Router)
  private videoPlaylistService = inject(VideoPlaylistService)
  private serverService = inject(ServerService)

  error: string

  ngOnInit () {
    this.buildForm({
      displayName: VIDEO_PLAYLIST_DISPLAY_NAME_VALIDATOR,
      privacy: VIDEO_PLAYLIST_PRIVACY_VALIDATOR,
      description: VIDEO_PLAYLIST_DESCRIPTION_VALIDATOR,
      videoChannelId: VIDEO_PLAYLIST_CHANNEL_ID_VALIDATOR,
      insertAtFirstPosition: null,
      thumbnailfile: null
    })

    this.form.get('privacy').valueChanges.subscribe(privacy => {
      setPlaylistChannelValidator(this.form.get('videoChannelId'), privacy)
    })

    listUserChannelsForSelect(this.authService, { includeCollaborations: true })
      .subscribe(channels => this.userVideoChannels = channels)

    this.serverService.getVideoPlaylistPrivacies()
      .subscribe(videoPlaylistPrivacies => {
        this.videoPlaylistPrivacies = videoPlaylistPrivacies

        this.form.patchValue({
          privacy: VideoPlaylistPrivacy.PRIVATE
        })
      })
  }

  formValidated () {
    this.error = undefined

    const body = this.form.value
    const videoPlaylistCreate: VideoPlaylistCreate = {
      displayName: body.displayName,
      privacy: body.privacy,
      description: body.description || null,
      videoChannelId: body.videoChannelId || null,
      thumbnailfile: body.thumbnailfile || null
    }

    this.videoPlaylistService.createVideoPlaylist(videoPlaylistCreate)
      .pipe(
        switchMap(({ videoPlaylist: { id } }) => {
          if (body.insertAtFirstPosition !== true || !body.videoChannelId) return of(true)

          const channelName = this.userVideoChannels.find(c => c.id === body.videoChannelId)?.name

          return this.videoPlaylistService.getVideoPlaylist(id)
            .pipe(
              switchMap(playlist => {
                return this.videoPlaylistService.reorderPlaylistsOfChannel(channelName, playlist.videoChannelPosition, 0)
              })
            )
        })
      )
      .subscribe({
        next: () => {
          this.notifier.success($localize`Playlist ${videoPlaylistCreate.displayName} created.`)
          this.router.navigate([ '/my-library', 'video-playlists' ])
        },

        error: err => {
          this.error = err.message
        }
      })
  }

  isCreation () {
    return true
  }

  isEditor () {
    return false
  }

  getOwnerAccountDisplayName () {
    return this.authService.getUser().account.displayName
  }

  getFormButtonTitle () {
    return $localize`Create`
  }
}
