import { Component, Input } from '@angular/core'
import { Notifier } from '@app/core'

@Component({
  selector: 'my-copy-button',
  styleUrls: [ './copy-button.component.scss' ],
  templateUrl: './copy-button.component.html'
})
export class CopyButtonComponent {
  @Input() value: string
  @Input() title: string
  @Input() notification: string
  @Input() isInputGroup = false

  constructor (private notifier: Notifier) {

  }

  activateCopiedMessage () {
    if (this.notification) this.notifier.success(this.notification)
  }
}
