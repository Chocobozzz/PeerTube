import { finalize } from 'rxjs/operators'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { Notifier } from '@app/core'
import { FindInBulkService } from '@app/shared/shared-search'
import { MiniatureDisplayOptions } from '../../shared-video-miniature'
import { VideoPlaylist } from '../../shared-video-playlist'
import { CustomMarkupComponent } from './shared'

/*
 * Markup component that creates a playlist miniature only
*/

@Component({
  selector: 'my-playlist-miniature-markup',
  templateUrl: 'playlist-miniature-markup.component.html',
  styleUrls: [ 'playlist-miniature-markup.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaylistMiniatureMarkupComponent implements CustomMarkupComponent, OnInit {
  @Input() uuid: string

  @Output() loaded = new EventEmitter<boolean>()

  playlist: VideoPlaylist

  displayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: false,
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
