import { Component, Input } from '@angular/core'
import { Notifier } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-input-readonly-copy',
  templateUrl: './input-readonly-copy.component.html',
  styleUrls: [ './input-readonly-copy.component.scss' ]
})
export class InputReadonlyCopyComponent {
  @Input() value = ''

  constructor (
    private notifier: Notifier,
    private i18n: I18n
  ) { }

  activateCopiedMessage () {
    this.notifier.success(this.i18n('Copied'))
  }
}
