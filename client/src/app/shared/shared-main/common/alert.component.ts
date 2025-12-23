import { NgClass } from '@angular/common'
import { booleanAttribute, Component, input, OnChanges, OnInit } from '@angular/core'

export type AlertType = 'success' | 'info' | 'warning' | 'danger' | 'primary'

@Component({
  selector: 'my-alert',
  templateUrl: './alert.component.html',
  imports: [ NgClass ]
})
export class AlertComponent implements OnInit, OnChanges {
  readonly type = input.required<AlertType>()
  readonly rounded = input(true, { transform: booleanAttribute })

  builtClasses = ''

  ngOnInit () {
    this.buildClasses()
  }

  ngOnChanges () {
    this.buildClasses()
  }

  private buildClasses () {
    this.builtClasses = 'alert'

    const type = this.type()
    if (type === 'primary') {
      this.builtClasses += ' pt-alert-primary'
    } else {
      this.builtClasses += ' alert-' + type
    }

    if (this.rounded() !== true) {
      this.builtClasses += ' rounded-0'
    }
  }
}
