import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core'
import { Router } from '@angular/router'
import { GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { LinkComponent } from '@app/shared/shared-main/common/link.component'
import { CustomMarkupComponent } from './shared'

/*
 * Markup component that creates a button
 */

@Component({
  selector: 'my-button-markup',
  templateUrl: 'button-markup.component.html',
  styleUrls: [ 'button-markup.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ LinkComponent ]
})
export class ButtonMarkupComponent implements CustomMarkupComponent {
  private router = inject(Router)

  readonly theme = input<'primary' | 'secondary'>(undefined)
  readonly href = input<string>(undefined)
  readonly path = input<string>(undefined)
  readonly label = input<string>(undefined)
  readonly blankTarget = input<boolean>(undefined)
  readonly icon = input<GlobalIconName>(undefined)

  // Parse the path so the router keeps its query params and fragment
  readonly pathUrlTree = computed(() => {
    return this.path()
      ? this.router.parseUrl(this.path())
      : undefined
  })

  channel: VideoChannel
  loaded: undefined

  getTarget () {
    if (this.blankTarget() === true) return '_blank'

    return '_self'
  }

  getClasses () {
    const additionalClass = this.theme() === 'primary'
      ? 'primary-button'
      : 'secondary-button'

    return [ 'peertube-button-link', additionalClass, this.icon() ? 'has-icon' : '' ].join(' ')
  }
}
