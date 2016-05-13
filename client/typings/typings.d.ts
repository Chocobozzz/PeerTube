/**
 * Declares the 'commonjs' format module object that identifies the "module id" for the current module.
 * Set a component's `moduleId` metadata property to `module.id` for module-relative urls
 * when the generated module format is 'commonjs'.
 */
declare var module: {id: string};

/**
 * Declares the 'system' format string that identifies the "module id" for the current module.
 * Set a component's `moduleId` metadata property to `__moduleName` for module-relative urls
 * when the generated module format is 'system'.
 */
declare var __moduleName: string;
