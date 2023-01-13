import { finalize } from 'rxjs/operators'
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { AuthService, Notifier } from '@app/core'
import { FindInBulkService } from '@app/shared/shared-search'
import { Video } from '../../shared-main'
import { MiniatureDisplayOptions } from '../../shared-video-miniature'
import { CustomMarkupComponent } from './shared'

/*
 * Markup component that creates a video miniature only
*/

@Component({
  selector: 'my-video-miniature-markup',
  templateUrl: 'video-miniature-markup.component.html',
  styleUrls: [ 'video-miniature-markup.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoMiniatureMarkupComponent implements CustomMarkupComponent, OnInit {
  @Input() uuid: string
  @Input() onlyDisplayTitle: boolean
  @Input() video: Video

  @Output() loaded = new EventEmitter<boolean>()

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
    private auth: AuthService,
    private findInBulk: FindInBulkService,
    private notifier: Notifier
  ) { }

  getUser () {
    return this.auth.getUser()
  }

  ngOnInit () {
    if (this.onlyDisplayTitle) {
      for (const key of Object.keys(this.displayOptions)) {
        this.displayOptions[key] = false
      }
    }

    if (this.video) return

    this.findInBulk.getVideo(this.uuid)
      .pipe(finalize(() => this.loaded.emit(true)))
      .subscribe({
        next: video => this.video = video,

        error: err => this.notifier.error($localize`Error in video miniature component: ${err.message}`)
      })
  }
}
