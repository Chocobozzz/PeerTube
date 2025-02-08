import { Component, forwardRef, Input, OnInit } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { ServerService } from '@app/core'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'
import { SelectCheckboxDefaultAllComponent } from './select-checkbox-default-all.component'
import { NgIf } from '@angular/common'

@Component({
  selector: 'my-select-categories',
  template: `
<my-select-checkbox-default-all
  *ngIf="availableCategories"
  [inputId]="inputId"
  [(ngModel)]="selectedCategories"
  (ngModelChange)="onModelChange()"
  [availableItems]="availableCategories"
  i18n-placeholder placeholder="Add a new category"
  i18n-allSelectedLabel allSelectedLabel="All categories"
  i18n-selectedLabel selectedLabel="{1} categories selected"
>
</my-select-checkbox-default-all>
`,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectCategoriesComponent),
      multi: true
    }
  ],
  imports: [ SelectCheckboxDefaultAllComponent, FormsModule, NgIf ]
})
export class SelectCategoriesComponent implements ControlValueAccessor, OnInit {
  @Input({ required: true }) inputId: string

  selectedCategories: string[]
  availableCategories: SelectOptionsItem[]

  constructor (
    private server: ServerService
  ) {

  }

  ngOnInit () {
    this.server.getVideoCategories()
      .subscribe(
        categories => {
          this.availableCategories = categories.map(c => ({ label: c.label, id: c.id + '' }))
        }
      )
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (categories: string[] | number[]) {
    this.selectedCategories = categories
      ? categories.map(c => c + '')
      : null
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(
      this.selectedCategories
        ? this.selectedCategories.map(c => c + '')
        : null
    )
  }
}
