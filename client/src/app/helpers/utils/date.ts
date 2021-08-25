import { DatePipe } from '@angular/common'

const datePipe = new DatePipe('en')
function dateToHuman (date: string) {
  return datePipe.transform(date, 'medium')
}

function durationToString (duration: number) {
  const hours = Math.floor(duration / 3600)
  const minutes = Math.floor((duration % 3600) / 60)
  const seconds = duration % 60

  const minutesPadding = minutes >= 10 ? '' : '0'
  const secondsPadding = seconds >= 10 ? '' : '0'
  const displayedHours = hours > 0 ? hours.toString() + ':' : ''

  return (
    displayedHours + minutesPadding + minutes.toString() + ':' + secondsPadding + seconds.toString()
  ).replace(/^0/, '')
}

export {
  durationToString,
  dateToHuman
}
