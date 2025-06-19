import { LogoType } from '@peertube/peertube-models'

const logoTypes = new Set<LogoType>([ 'favicon', 'header-square', 'header-wide', 'opengraph' ])

export function isConfigLogoTypeValid (value: LogoType) {
  return logoTypes.has(value)
}
