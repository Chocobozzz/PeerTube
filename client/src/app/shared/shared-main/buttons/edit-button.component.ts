import { Component, Input, OnInit } from '@angular/core'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-edit-button',
  styleUrls: [ './button.component.scss' ],
  templateUrl: './edit-button.component.html'
})

export class EditButtonComponent implements OnInit {
  @Input() label: string
  @Input() title: string
  @Input() routerLink: string[] | string = []

  constructor (private i18n: I18n) { }

  ngOnInit () {
    // <my-edit-button /> No label
    if (this.label === undefined && !this.title) {
      this.title = this.i18n('Update')
    }

    // <my-edit-button label /> Use default label
    if (this.label === '') {
      this.label = this.i18n('Update')

      if (!this.title) {
        this.title = this.label
      }
    }
  }
}
