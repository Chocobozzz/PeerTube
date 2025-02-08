import { NgClass, NgIf, NgTemplateOutlet } from '@angular/common'
import { booleanAttribute, Component, Input, OnChanges, OnInit } from '@angular/core'
import { RouterLink } from '@angular/router'

export type AlertType = 'success' | 'info' | 'warning' | 'danger' | 'primary'

@Component({
  selector: 'my-alert',
  styleUrls: [ './alert.component.scss' ],
  templateUrl: './alert.component.html',
  imports: [ NgIf, RouterLink, NgClass, NgTemplateOutlet ]
})
export class AlertComponent implements OnInit, OnChanges {
  @Input({ required: true }) type: AlertType
  @Input({ transform: booleanAttribute }) rounded = true

  builtClasses = ''

  ngOnInit () {
    this.buildClasses()
  }

  ngOnChanges () {
    this.buildClasses()
  }

  private buildClasses () {
    this.builtClasses = 'alert'

    if (this.type === 'primary') {
      this.builtClasses += ' pt-alert-primary'
    } else {
      this.builtClasses += ' alert-' + this.type
    }

    if (this.rounded !== true) {
      this.builtClasses += ' rounded-0'
    }
  }
}
