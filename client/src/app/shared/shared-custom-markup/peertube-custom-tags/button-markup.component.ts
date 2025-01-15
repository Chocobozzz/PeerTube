import { ChangeDetectionStrategy, Component, Input } from '@angular/core'
import { CustomMarkupComponent } from './shared'
import { NgClass } from '@angular/common'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'

/*
 * Markup component that creates a button
*/

@Component({
  selector: 'my-button-markup',
  templateUrl: 'button-markup.component.html',
  styleUrls: [ 'button-markup.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ NgClass ]
})
export class ButtonMarkupComponent implements CustomMarkupComponent {
  @Input() theme: 'primary' | 'secondary'
  @Input() href: string
  @Input() label: string
  @Input() blankTarget?: boolean

  channel: VideoChannel
  loaded: undefined

  getTarget () {
    if (this.blankTarget === true) return '_blank'

    return ''
  }

  getClasses () {
    const additionalClass = this.theme === 'primary'
      ? 'primary-button'
      : 'secondary-button'

    return [ 'peertube-button-link', additionalClass ]
  }
}
