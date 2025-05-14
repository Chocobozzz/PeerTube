export const NSFWFlag = {
  NONE: 0 << 0,
  VIOLENT: 1 << 0,
  EXPLICIT_SEX: 1 << 1
} as const

export type NSFWFlagType = typeof NSFWFlag[keyof typeof NSFWFlag]

export type NSFWFlagString =
  | 'violent'
  | 'explicitSex'

const nsfwFlagsToStringMap: {
  [key in NSFWFlagString]: NSFWFlagType
} = {
  violent: NSFWFlag.VIOLENT,
  explicitSex: NSFWFlag.EXPLICIT_SEX
} as const

const nsfwFlagsStringToEnumMap: {
  [key in NSFWFlagType]: NSFWFlagString
} = {
  [NSFWFlag.VIOLENT]: 'violent',
  [NSFWFlag.EXPLICIT_SEX]: 'explicitSex'
} as const

export function nsfwFlagToString (nsfwFlag: NSFWFlagType): NSFWFlagString {
  return nsfwFlagsStringToEnumMap[nsfwFlag]
}

export function nsfwFlagsToString (nsfwFlags: number): NSFWFlagString[] {
  const acc: NSFWFlagString[] = []

  for (const [ flagString, flag ] of Object.entries(nsfwFlagsToStringMap)) {
    if ((nsfwFlags & flag) === flag) {
      acc.push(flagString as NSFWFlagString)
    }
  }

  return acc
}

export function stringToNSFWFlag (nsfwFlag: NSFWFlagString): NSFWFlagType {
  return nsfwFlagsToStringMap[nsfwFlag]
}
