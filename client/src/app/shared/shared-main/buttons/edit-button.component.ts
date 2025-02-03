import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core'
import { ButtonComponent } from './button.component'

@Component({
  selector: 'my-edit-button',
  template: `
    <my-button
      icon="edit" [label]="label" [title]="title" [responsiveLabel]="responsiveLabel"
      [ptRouterLink]="ptRouterLink"
    ></my-button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ ButtonComponent ]
})
export class EditButtonComponent implements OnChanges {
  @Input() label: string
  @Input() title: string
  @Input() ptRouterLink: string[] | string = []
  @Input() responsiveLabel = false

  ngOnChanges () {
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
