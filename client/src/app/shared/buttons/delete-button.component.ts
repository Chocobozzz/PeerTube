import { Component, Input } from '@angular/core'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-delete-button',
  styleUrls: [ './button.component.scss' ],
  templateUrl: './delete-button.component.html'
})

export class DeleteButtonComponent {
  @Input() label: string

  constructor (private i18n: I18n) { }

  getTitle () {
    return this.label || this.i18n('Delete')
  }
}
