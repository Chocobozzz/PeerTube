import { Component, Input } from '@angular/core'
import { Notifier } from '@app/core'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { NgClass } from '@angular/common'
import { CdkCopyToClipboard } from '@angular/cdk/clipboard'

@Component({
  selector: 'my-copy-button',
  styleUrls: [ './copy-button.component.scss' ],
  templateUrl: './copy-button.component.html',
  standalone: true,
  imports: [ CdkCopyToClipboard, NgClass, GlobalIconComponent ]
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
