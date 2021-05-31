import { Component, Input } from '@angular/core'
import { VideoChannel } from '../../shared-main'

/*
 * Markup component that creates a button
*/

@Component({
  selector: 'my-button-markup',
  templateUrl: 'button-markup.component.html',
  styleUrls: [ 'button-markup.component.scss' ]
})
export class ButtonMarkupComponent {
  @Input() theme: 'primary' | 'secondary'
  @Input() href: string
  @Input() label: string
  @Input() blankTarget?: boolean

  channel: VideoChannel

  getTarget () {
    if (this.blankTarget === true) return '_blank'

    return ''
  }

  getClasses () {
    const additionalClass = this.theme === 'primary'
      ? 'orange-button'
      : 'grey-button'

    return [ 'peertube-button-link', additionalClass ]
  }
}
