import { Pipe, PipeTransform } from '@angular/core'

@Pipe({
  name: 'myDaysDurationFormatter',
  standalone: true
})
export class DaysDurationFormatterPipe implements PipeTransform {

  transform (value: number): string {
    const days = Math.floor(value / (3600 * 24 * 1000))

    if (days <= 1) return $localize`1 day`

    return $localize`${days} days`
  }
}
