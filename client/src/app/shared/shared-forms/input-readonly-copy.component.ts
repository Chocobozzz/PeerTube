import { Component, Input } from '@angular/core'
import { Notifier } from '@app/core'
import { FormGroup } from '@angular/forms'

@Component({
  selector: 'my-input-readonly-copy',
  templateUrl: './input-readonly-copy.component.html',
  styleUrls: [ './input-readonly-copy.component.scss' ]
})
export class InputReadonlyCopyComponent {
  @Input() id: string
  @Input() value = ''

  constructor (private notifier: Notifier) { }

  activateCopiedMessage () {
    this.notifier.success($localize`Copied`)
  }
}
