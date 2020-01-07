import { Pipe, PipeTransform } from '@angular/core'

// Thanks: https://stackoverflow.com/a/46055604

@Pipe({
  name: 'myVideoDurationFormatter'
})
export class VideoDurationPipe implements PipeTransform {
  transform (value: number): string {
    const minutes = Math.floor(value / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return hours + ' h ' + (minutes - hours * 60) + ' min ' + (value - (minutes - hours * 60) * 60) + ' sec'
    }

    return minutes + ' min ' + (value - minutes * 60) + ' sec'
  }
}
