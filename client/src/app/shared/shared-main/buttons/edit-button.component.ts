import { Component, Input, OnInit } from '@angular/core'

@Component({
  selector: 'my-edit-button',
  template: `
    <my-button
      icon="edit" className="grey-button-link"
      [label]="label" [title]="title" [responsiveLabel]="responsiveLabel"
      [ptRouterLink]="ptRouterLink"
    ></my-button>
  `
})
export class EditButtonComponent implements OnInit {
  @Input() label: string
  @Input() title: string
  @Input() ptRouterLink: string[] | string = []
  @Input() responsiveLabel = false

  ngOnInit () {
    // <my-edit-button /> No label
    if (this.label === undefined && !this.title) {
      this.title = $localize`Update`
    }

    // <my-edit-button label /> Use default label
    if (this.label === '') {
      this.label = $localize`Update`
    }
  }
}
