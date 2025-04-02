import { DatePipe } from '@angular/common'
import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core'

// Re-implementation of the angular date pipe that uses the web browser locale to display dates

@Pipe({
  name: 'ptDate',
  pure: true,
  standalone: true
})
export class PTDatePipe implements PipeTransform {
  private angularPipe: DatePipe
  private customLocaleId: string

  constructor () {
    const localeId = inject(LOCALE_ID)

    if (navigator.language.includes('-') && navigator.language.split('-')[0] === localeId.split('-')[0]) {
      this.customLocaleId = navigator.language
    } else {
      this.customLocaleId = localeId
    }

    this.angularPipe = new DatePipe(localeId)
  }

  transform (value: Date | string | number | null | undefined, format?: string): string {
    if (format === 'short') return new Date(value).toLocaleString(this.customLocaleId)
    if (format === 'shortDate') return new Date(value).toLocaleDateString(this.customLocaleId)

    return this.angularPipe.transform(value, format)
  }
}
