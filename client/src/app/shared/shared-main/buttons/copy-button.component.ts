import { Clipboard } from '@angular/cdk/clipboard'
import { NgClass } from '@angular/common'
import { booleanAttribute, Component, inject, input } from '@angular/core'
import { Notifier } from '@app/core'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'

@Component({
  selector: 'my-copy-button',
  styleUrls: [ './copy-button.component.scss' ],
  templateUrl: './copy-button.component.html',
  providers: [ Clipboard ],
  imports: [ NgClass, GlobalIconComponent ]
})
export class CopyButtonComponent {
  private notifier = inject(Notifier)
  private clipboard = inject(Clipboard)

  readonly value = input<string>(undefined)
  readonly elementContent = input<HTMLElement>(undefined)

  readonly title = input<string>(undefined)
  readonly notification = input<string>(undefined)

  readonly withBorder = input(false, { transform: booleanAttribute })
  readonly isInputGroup = input(false, { transform: booleanAttribute })

  copy () {
    this.clipboard.copy(this.value() || this.elementContent()?.innerText)

    const notification = this.notification()
    if (notification) this.notifier.success(notification)
  }
}
