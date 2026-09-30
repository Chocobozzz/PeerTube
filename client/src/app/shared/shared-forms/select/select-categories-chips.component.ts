import { Component, forwardRef, OnInit, inject, input, ChangeDetectionStrategy } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { ServerService } from '@app/core'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'

@Component({
  selector: 'my-select-categories-chips',
  templateUrl: './select-categories-chips.component.html',
  styleUrls: [ './select-categories-chips.component.scss' ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectCategoriesChipsComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class SelectCategoriesChipsComponent implements ControlValueAccessor, OnInit {
  private server = inject(ServerService)

  readonly inputId = input.required<string>()

  availableCategories: SelectOptionsItem[] = []
  selectedCategories: string[] = []

  disabled = false

  propagateChange = (_: any) => {
    // empty
  }

  ngOnInit () {
    this.server.getVideoCategories()
      .subscribe(categories => this.availableCategories = categories.map(c => ({ label: c.label, id: c.id + '' })))
  }

  writeValue (categories: string[] | number[]) {
    this.selectedCategories = categories?.map(category => category + '') || []
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  setDisabledState (isDisabled: boolean) {
    this.disabled = isDisabled
  }

  isSelected (category: SelectOptionsItem) {
    return this.selectedCategories.includes(category.id + '')
  }

  isAllCategories () {
    return this.selectedCategories.length === 0
  }

  onCategoryChange (category: SelectOptionsItem, event: Event) {
    const categoryId = category.id + ''
    const isChecked = (event.target as HTMLInputElement).checked

    this.selectedCategories = isChecked
      ? [ ...this.selectedCategories, categoryId ]
      : this.selectedCategories.filter(id => id !== categoryId)

    // Selecting every category is equivalent to not applying a category filter.
    if (this.selectedCategories.length === this.availableCategories.length) {
      this.selectedCategories = []
    }

    this.propagateChange(this.selectedCategories.length === 0 ? null : this.selectedCategories)
  }

  selectAll () {
    this.selectedCategories = []
    this.propagateChange(null)
  }
}
