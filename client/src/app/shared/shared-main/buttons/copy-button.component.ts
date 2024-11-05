import { Clipboard } from '@angular/cdk/clipboard'
import { NgClass } from '@angular/common'
import { booleanAttribute, Component, Input } from '@angular/core'
import { Notifier } from '@app/core'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'

@Component({
  selector: 'my-copy-button',
  styleUrls: [ './copy-button.component.scss' ],
  templateUrl: './copy-button.component.html',
  standalone: true,
  providers: [ Clipboard ],
  imports: [ NgClass, GlobalIconComponent ]
})
export class CopyButtonComponent {
  @Input() value: string
  @Input() elementContent: HTMLElement

  @Input() title: string
  @Input() notification: string

  @Input({ transform: booleanAttribute }) withBorder = false
  @Input({ transform: booleanAttribute }) isInputGroup = false

  constructor (private notifier: Notifier, private clipboard: Clipboard) {

  }

  copy () {
    this.clipboard.copy(this.value || this.elementContent?.innerText)

    if (this.notification) this.notifier.success(this.notification)
  }
}
