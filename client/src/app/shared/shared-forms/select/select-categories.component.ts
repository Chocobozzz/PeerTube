import { Component, forwardRef, Input, OnInit } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms'
import { ServerService } from '@app/core'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'
import { ItemSelectCheckboxValue } from './select-checkbox.component'
import { SelectCheckboxAllComponent } from './select-checkbox-all.component'

@Component({
  selector: 'my-select-categories',
  styleUrls: [ './select-shared.component.scss' ],
  templateUrl: './select-categories.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectCategoriesComponent),
      multi: true
    }
  ],
  standalone: true,
  imports: [ SelectCheckboxAllComponent, FormsModule ]
})
export class SelectCategoriesComponent implements ControlValueAccessor, OnInit {
  @Input({ required: true }) labelForId: string

  selectedCategories: ItemSelectCheckboxValue[] = []
  availableCategories: SelectOptionsItem[] = []

  allCategoriesGroup = $localize`All categories`

  // Fix a bug on ng-select when we update items after we selected items
  private toWrite: any
  private loaded = false

  constructor (
    private server: ServerService
  ) {

  }

  ngOnInit () {
    this.server.getVideoCategories()
      .subscribe(
        categories => {
          this.availableCategories = categories.map(c => ({ label: c.label, id: c.id + '', group: this.allCategoriesGroup }))
          this.loaded = true
          this.writeValue(this.toWrite)
        }
      )
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (categories: string[] | number[]) {
    if (!this.loaded) {
      this.toWrite = categories
      return
    }

    this.selectedCategories = categories
      ? categories.map(c => c + '')
      : categories as string[]
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this.selectedCategories)
  }
}
