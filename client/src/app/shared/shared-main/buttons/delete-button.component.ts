import { Component, Input, OnInit, booleanAttribute } from '@angular/core'
import { ButtonComponent } from './button.component'

@Component({
  selector: 'my-delete-button',
  template: `
    <my-button
      icon="delete" className="grey-button"
      [disabled]="disabled" [label]="label" [title]="title"
      [loading]="loading"
      [responsiveLabel]="responsiveLabel"
    ></my-button>
  `,
  standalone: true,
  imports: [ ButtonComponent ]
})
export class DeleteButtonComponent implements OnInit {
  @Input() label: string
  @Input() title: string
  @Input() responsiveLabel = false
  @Input() disabled: boolean
  @Input({ transform: booleanAttribute }) loading = false

  ngOnInit () {
    if (this.label === undefined && !this.title) {
      this.title = $localize`Delete`
    }

    // <my-delete-button label /> Use default label
    if (this.label === '') {
      this.label = $localize`Delete`
    }
  }
}
