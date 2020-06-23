import { Component, Input, OnInit } from '@angular/core'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-delete-button',
  styleUrls: [ './button.component.scss' ],
  templateUrl: './delete-button.component.html'
})

export class DeleteButtonComponent implements OnInit {
  @Input() label: string

  title: string

  constructor (private i18n: I18n) { }

  ngOnInit () {
    this.title = this.label || this.i18n('Delete')
  }
}
