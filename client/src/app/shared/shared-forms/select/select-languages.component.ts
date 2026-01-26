import { Component, forwardRef, inject, input, OnInit } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { ServerService } from '@app/core'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'
import { SelectCheckboxDefaultAllComponent } from './select-checkbox-default-all.component'

@Component({
  selector: 'my-select-languages',
  template: `
@if (availableLanguages) {
  <my-select-checkbox-default-all
    [availableItems]="availableLanguages"
    [(ngModel)]="selectedLanguages"
    (ngModelChange)="onModelChange()"
    [inputId]="inputId()"
    [maxIndividualItems]="maxLanguages()"
    virtualScroll="true"
    virtualScrollItemSize="37"
    i18n-allSelectedLabel allSelectedLabel="All languages"
    i18n-selectedLabel selectedLabel="{1} languages selected"
    i18n-placeholder placeholder="Add a new language"
    >
  </my-select-checkbox-default-all>
}
`,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectLanguagesComponent),
      multi: true
    }
  ],
  imports: [ SelectCheckboxDefaultAllComponent, FormsModule ]
})
export class SelectLanguagesComponent implements ControlValueAccessor, OnInit {
  private server = inject(ServerService)

  readonly inputId = input.required<string>()
  readonly maxLanguages = input<number>(undefined)

  selectedLanguages: string[]
  availableLanguages: SelectOptionsItem[]

  ngOnInit () {
    this.server.getVideoLanguages()
      .subscribe(
        languages => {
          const noLangSet = languages.find(l => l.id === 'zxx')

          this.availableLanguages = [
            {
              label: $localize`Unknown language`,
              id: '_unknown'
            },

            noLangSet,

            ...languages
              .filter(l => l.id !== 'zxx')
              .map(l => ({ label: l.label, id: l.id }))
          ]
        }
      )
  }

  propagateChange = (_: any) => {
    // empty
  }

  writeValue (languages: string[]) {
    this.selectedLanguages = languages
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this.selectedLanguages)
  }
}
