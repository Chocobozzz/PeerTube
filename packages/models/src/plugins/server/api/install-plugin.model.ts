export interface InstallOrUpdatePlugin {
  npmName?: string
  pluginVersion?: string
  path?: string

  // Required if password confirmation is enabled
  currentPassword?: string
}
