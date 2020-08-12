import { Pipe, PipeTransform } from '@angular/core'

@Pipe({
  name: 'myVideoDurationFormatter'
})
export class VideoDurationPipe implements PipeTransform {

  transform (value: number): string {
    const hours = Math.floor(value / 3600)
    const minutes = Math.floor((value % 3600) / 60)
    const seconds = value % 60

    if (hours > 0) {
      return $localize`${hours} h ${minutes} min ${seconds} sec`
    }

    if (minutes > 0) {
      return $localize`${minutes} min ${seconds} sec`
    }

    return $localize`${seconds} sec`
  }
}
