 # Server code

## Database model typing

Sequelize models contain optional fields corresponding to table joins.
For example, `VideoModel` has a `VideoChannel?: VideoChannelModel` field. It can be filled if the SQL query joined with the `videoChannel` table or empty if not.
It can be difficult in TypeScript to understand if a function argument expects associations to be filled or not.
To improve clarity and reduce bugs, PeerTube defines multiple versions of a database model depending on its associations in `server/core/types/models/`.
These models start with `M` and by default do not include any association. `MVideo` for example corresponds to `VideoModel` without any association, where `VideoChannel` attribute doesn't exist. On the other hand, `MVideoWithChannel` is a `MVideo` that has a `VideoChannel` field. This way, a function that accepts `video: MVideoWithChannel` argument expects a video with channel populated. Main PeerTube code should never use `...Model` (`VideoModel`) database type, but always `M...` instead (`MVideo`, `MVideoChannel` etc).

## Add a new feature walkthrough

Here's a list of all the parts of the server to update if you want to add a new feature (new API REST endpoints for example) to the PeerTube server.
Some of these may be optional (for example your new endpoint may not need to send notifications) but this guide tries to be exhaustive.

 * Configuration:
   - Add your new configuration key in `config/default.yaml` and `config/production.yaml.example`
   - Add it to the Docker configuration in `support/docker/production/config/production.yaml`, and map it to a `PEERTUBE_*` environment variable in `support/docker/production/config/custom-environment-variables.yaml`
   - Regenerate the configuration JSON schema with `npm run generate-config-schema` and commit `config/config-schema.json` (see [Configuration JSON schema](#configuration-json-schema))
   - If your configuration needs to be different in dev or tests environments, also update `config/dev.yaml` and `config/test.yaml`
   - Load your configuration in `server/core/initializers/config.ts`
   - Check new configuration keys are set in `server/core/initializers/checker-before-init.ts`
   - You can also ensure configuration consistency in `server/core/initializers/checker-after-init.ts`
   - If you want your configuration to be available in the client:
     + Add your field in `packages/models/src/server/server-config.model.ts`
     + Update `server/core/lib/server-config-manager.ts` to include your new configuration
   - If you want your configuration to be updatable by the web admin in the client:
     + Add your field in `packages/models/src/server/custom-config.model.ts`
     + Add the configuration to the config object in the `server/core/controllers/api/config.ts` controller
     + Validate the new field in `server/core/middlewares/validators/config.ts`
     + Add the field to the admin configuration form in `client/src/app/+admin/config`
     + Update the config tests in `packages/tests/src/api/server/config.ts` and `packages/tests/src/api/check-params/config.ts`
 * Controllers:
   - Create the controller file and fill it with your REST API routes
   - Import and use your controller in the parent controller
   - Secondary processes (horizontal scalability) serve every route. If your route needs a state only the primary process has, add the `primaryOnly` middleware
 * Middlewares:
   - Create your validator middleware in `server/core/middlewares/validators` that will be used by your controllers
   - Add your new middleware file to `server/core/middlewares/validators/index.ts` so it's easier to import
   - Create the entry in `server/core/types/express.d.ts` to attach the database model loaded by your middleware to the express response
 * Validators:
   - Create your validators that will be used by your middlewares in `server/core/helpers/custom-validators`
 * Typescript models:
   - Create the API models (request parameters or response) in `packages/models`
   - Add your models in `index.ts` of current directory to facilitate the imports
 * Sequelize model (database):
   - If you need to create a new table:
     + Create the Sequelize model in `server/core/models/`:
       * Create the `@Column`
       * Add some indexes if you need
       * Create static methods to load a specific row from the database `loadBy...`
       * Create static methods to load a list of models from the database `listBy...`
       * Create the instance method `toFormattedJSON` that creates the JSON to send to the REST API from the model
     + Add your new Sequelize model to `server/core/initializers/database.ts`
     + Create a new file in `server/core/types/models/<entity>/` to define multiple versions of your Sequelize model depending on database associations (see [Database model typing](#database-model-typing))
     + Export this new file in the `index.ts` of that directory to facilitate the imports
     + Create database migrations:
       * Create the migration file in `server/core/initializers/migrations` using raw SQL (copy the same SQL query as at PeerTube startup)
       * Update `LAST_MIGRATION_VERSION` in `server/core/initializers/constants.ts`
   - If updating database schema (adding/removing/renaming a column):
     + Update the sequelize models in `server/core/models/`
     + Add migrations:
       * Create the migration file in `server/core/initializers/migrations` using Sequelize Query Interface (`.addColumn`, `.dropTable`, `.changeColumn`)
       * Update `LAST_MIGRATION_VERSION` in `server/core/initializers/constants.ts`
 * Notifications:
   - Create the new notification model in `packages/models/src/users/user-notification.model.ts`
   - Create the notification logic in `server/core/lib/notifier/shared`:
     + Email subject has a common prefix (defined by the admin in PeerTube configuration)
   - Add your notification to `server/core/lib/notifier/notifier.ts`
   - Create the email template in `server/core/assets/email-templates`:
     + A text version is automatically generated from the HTML
     + Create a `html.hbs` Handlebars template in a new directory named after your template
     + Wrap your content in the `base` partial that provides the common layout, greetings and signature. Partials live in `server/core/assets/email-templates/partials`
     + Use the `t` helper to translate strings:

       ```handlebars
       {{#> base title="My title"}}
         <p>{{t "My text"}}</p>
       {{/base}}
       ```

   - If you need to associate a new table with `userNotification`:
     + Associate the new table in `UserNotificationModel` (don't forget the index)
     + Add the object property in the API model definition (`packages/models/src/users/user-notification.model.ts`)
     + Add the object in `UserNotificationModel.toFormattedJSON`
     + Handle this new notification type in client (`UserNotificationsComponent`)
     + Handle the new object property in client model (`UserNotification`)
 * Tests:
   - Create your command class in `packages/server-commands/` that will wrap HTTP requests to your new endpoint
   - Add your command file in `index.ts` of current directory
   - Instantiate your command class in `packages/server-commands/src/server/server.ts`
   - Create your test file in `packages/tests/src/api/check-params` to test middleware validators/authentication/user rights (offensive tests)
   - Create your test file in the appropriate `packages/tests/src/api/<suite>` subdirectory (`server`, `videos`, `users`...) to test your new endpoints. CI only runs files from the subdirectories listed in `scripts/ci.sh`, so register any new subdirectory there
   - Add your notification test in `packages/tests/src/api/notifications`, and a check helper for your new notification type in `packages/tests/src/shared/notifications`
 * Update REST API documentation in `support/doc/api/openapi.yaml`

## Configuration JSON schema

PeerTube ships a script that converts `config/default.yaml` into a [JSON Schema Draft 7](https://json-schema.org/draft-07/schema) document at `config/config-schema.json`.

The schema covers **all** configuration keys (not just the subset exposed in the web admin panel), which makes it useful for:

- Generating configuration UIs for the full YAML configuration file.
- Feeding documentation generators or editor integrations.
- Validating NixOS service module configuration without having to declare every option explicitly.

The generated file is committed to the repository at `config/config-schema.json` and should be regenerated whenever `config/default.yaml` changes:

```bash
npm run generate-config-schema
```

The schema is also used by CI to validate `config/default.yaml` and `support/docker/production/config/production.yaml`. Run the check locally with:

```bash
npm run validate-config-schema
```
