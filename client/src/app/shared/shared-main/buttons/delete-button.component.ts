import { Component, Input, OnInit } from '@angular/core'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-delete-button',
  styleUrls: [ './button.component.scss' ],
  templateUrl: './delete-button.component.html'
})

export class DeleteButtonComponent implements OnInit {
  @Input() label: string
  @Input() title: string

  constructor (private i18n: I18n) { }

  ngOnInit () {
    // <my-delete-button /> No label
    if (this.label === undefined && !this.title) {
      this.title = this.i18n('Delete')
    }

    // <my-delete-button label /> Use default label
    if (this.label === '') {
      this.label = this.i18n('Delete')

      if (!this.title) {
        this.title = this.label
      }
    }
  }
}
