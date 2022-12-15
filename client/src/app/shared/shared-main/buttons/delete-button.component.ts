import { Component, Input, OnInit } from '@angular/core'

@Component({
  selector: 'my-delete-button',
  template: `
    <my-button
      icon="delete" className="grey-button"
      [disabled]="disabled" [label]="label" [title]="title"
      [responsiveLabel]="responsiveLabel"
    ></my-button>
  `
})
export class DeleteButtonComponent implements OnInit {
  @Input() label: string
  @Input() title: string
  @Input() responsiveLabel = false
  @Input() disabled: boolean

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
