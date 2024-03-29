export interface DurationDescriptor {
  duration: number
  unit: string
}

export function toHumanReadable (ms: number) {
  const date = new Date(ms)

  const durationDescriptors: DurationDescriptor[] = [
    { duration: date.getUTCHours(), unit: 'h' },
    { duration: date.getUTCMinutes(), unit: 'm' },
    { duration: date.getUTCSeconds(), unit: 's' }
  ]

  return durationDescriptors
    .map(toWords)
    .filter((words) => words)
    .join(' ')
}

export function toWords ({ duration, unit }: DurationDescriptor) {
  return duration > 0 ? `${duration}${unit}` : ''
}

export function toTimecode (s: number | string) {
  const date = new Date(0, 0, 0, 0, 0, parseFloat(s.toString()), 0)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()
  return `${padLeft(hours)}:${padLeft(minutes)}:${padLeft(seconds)}`
}

function padLeft (value: number, length = 2): string {
  return value.toString().padStart(length, '0')
}
