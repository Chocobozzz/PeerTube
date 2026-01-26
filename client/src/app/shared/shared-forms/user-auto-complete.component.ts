import { Component, forwardRef, inject, input, model } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { Notifier, UserService } from '@app/core'
import { AutoCompleteModule } from 'primeng/autocomplete'
import { InputMaskModule } from 'primeng/inputmask'

@Component({
  selector: 'my-user-auto-complete',
  templateUrl: './user-auto-complete.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UserAutoCompleteComponent),
      multi: true
    }
  ],
  imports: [ InputMaskModule, FormsModule, AutoCompleteModule ]
})
export class UserAutoCompleteComponent implements ControlValueAccessor {
  private userService = inject(UserService)
  private notifier = inject(Notifier)

  readonly inputName = input<string>(undefined)

  readonly value = model('')

  suggestions: string[] = []

  propagateChange = (_: any) => {
    // empty
  }

  writeValue (value: string) {
    this.value.set(value)
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  completeMethod (event: { query: string }) {
    const query = event.query

    this.userService.autocomplete(query)
      .subscribe({
        next: usernames => this.suggestions = usernames,

        error: err => this.notifier.handleError(err)
      })
  }
}
