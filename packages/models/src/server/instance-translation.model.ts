export const INSTANCE_TRANSLATABLE_FIELDS = [
  'shortDescription',
  'description',
  'terms',
  'codeOfConduct',
  'moderationInformation',
  'administrator',
  'creationReason',
  'maintenanceLifetime',
  'businessModel',
  'hardwareInformation',
  'supportText'
] as const

export type InstanceTranslatableField = typeof INSTANCE_TRANSLATABLE_FIELDS[number]

export type InstanceTranslation = { language: string } & Record<InstanceTranslatableField, string>
