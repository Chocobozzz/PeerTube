import { finalize } from 'rxjs/operators'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { Notifier } from '@app/core'
import { CustomMarkupComponent } from './shared'
import { VideoPlaylistMiniatureComponent } from '../../shared-video-playlist/video-playlist-miniature.component'
import { NgIf } from '@angular/common'
import { FindInBulkService } from '@app/shared/shared-search/find-in-bulk.service'
import { MiniatureDisplayOptions } from '@app/shared/shared-video-miniature/video-miniature.component'
import { VideoPlaylist } from '@app/shared/shared-video-playlist/video-playlist.model'

/*
 * Markup component that creates a playlist miniature only
*/

@Component({
  selector: 'my-playlist-miniature-markup',
  templateUrl: 'playlist-miniature-markup.component.html',
  styleUrls: [ 'playlist-miniature-markup.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ NgIf, VideoPlaylistMiniatureComponent ]
})
export class PlaylistMiniatureMarkupComponent implements CustomMarkupComponent, OnInit {
  @Input() uuid: string

  @Output() loaded = new EventEmitter<boolean>()

  playlist: VideoPlaylist

  displayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: true,
    privacyLabel: false,
    privacyText: false,
    state: false,
    blacklistInfo: false
  }

  constructor (
    private findInBulkService: FindInBulkService,
    private notifier: Notifier,
    private cd: ChangeDetectorRef
  ) { }

  ngOnInit () {
    this.findInBulkService.getPlaylist(this.uuid)
      .pipe(finalize(() => this.loaded.emit(true)))
      .subscribe({
        next: playlist => {
          this.playlist = playlist
          this.cd.markForCheck()
        },

        error: err => this.notifier.error($localize`Error in playlist miniature component: ${err.message}`)
      })
  }
}
