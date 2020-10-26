import { Pipe, PipeTransform } from '@angular/core'

@Pipe({
  name: 'myDurationFormatter'
})
export class DurationFormatterPipe implements PipeTransform {

  transform (value: number): string {
    const hours = Math.floor(value / 3600)
    const minutes = Math.floor((value % 3600) / 60)
    const seconds = value % 60

    if (hours > 0) {
      let result = $localize`${hours}h`

      if (minutes !== 0) result += ' ' + $localize`${minutes}min`
      if (seconds !== 0) result += ' ' + $localize`${seconds}sec`

      return result
    }

    if (minutes > 0) {
      let result = $localize`${minutes}min`

      if (seconds !== 0) result += ' ' + `${seconds}sec`

      return result
    }

    return $localize`${seconds} sec`
  }
}
