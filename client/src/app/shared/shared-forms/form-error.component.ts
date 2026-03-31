import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { FieldState } from '@angular/forms/signals'

@Component({
  selector: 'my-form-error',
  templateUrl: './form-error.component.html',
  styleUrls: [],
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormErrorComponent {
  field = input.required<FieldState<any>>()
}
