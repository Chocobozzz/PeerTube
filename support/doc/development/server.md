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
   - Add you new configuration key in `config/default.yaml` and `config/production.yaml`
   - If you configuration needs to be different in dev or tests environments, also update `config/dev.yaml` and `config/test.yaml`
   - Load your configuration in `server/core/initializers/config.ts`
   - Check new configuration keys are set in `server/core/initializers/checker-before-init.ts`
   - You can also ensure configuration consistency in `server/core/initializers/checker-after-init.ts`
   - If you want your configuration to be available in the client:
     + Add your field in `packages/models/src/server/core/server-config.model.ts`
     + Update `server/core/lib/server-config-manager.ts` to include your new configuration
   - If you want your configuration to be updatable by the web admin in the client:
     + Add your field in `packages/models/src/server/core/custom-config.model.ts`
     + Add the configuration to the config object in the `server/core/controllers/api/config.ts` controller
 * Controllers:
   - Create the controller file and fill it with your REST API routes
   - Import and use your controller in the parent controller
 * Middlewares:
   - Create your validator middleware in `server/core/middlewares/validators` that will be used by your controllers
   - Add your new middleware file `server/core/middlewares/validators/index.ts` so it's easier to import
   - Create the entry in `server/core/types/express.d.ts` to attach the database model loaded by your middleware to the express response
 * Validators:
   - Create your validators that will be used by your middlewares in `server/core/helpers/custom-validators`
 * Typescript models:
   - Create the API models (request parameters or response) in `packages/models`
   - Add your models in `index.ts` of current directory to facilitate the imports
 * Sequelize model (BDD):
   - If you need to create a new table:
     + Create the Sequelize model in `server/core/models/`:
       * Create the `@Column`
       * Add some indexes if you need
       * Create static methods to load a specific from the database `loadBy...`
       * Create static methods to load a list of models from the database `listBy...`
       * Create the instance method `toFormattedJSON` that creates the JSON to send to the REST API from the model
     + Add your new Sequelize model to `server/core/initializers/database.ts`
     + Create a new file in `server/core/types` to define multiple versions of your Sequelize model depending on database associations
     + Add this new file to `server/core/types/*/index.ts` to facilitate the imports
     + Create database migrations:
       * Create the migration file in `server/core/initializers/migrations` using raw SQL (copy the same SQL query as at PeerTube startup)
       * Update `LAST_MIGRATION_VERSION` in `server/core/initializers/constants.ts`
   - If updating database schema (adding/removing/renaming a column):
     + Update the sequelize models in `server/core/models/`
     + Add migrations:
       * Create the migration file in `initializers/migrations` using Sequelize Query Interface (`.addColumn`, `.dropTable`, `.changeColumn`)
       * Update `LAST_MIGRATION_VERSION` in `server/core/initializers/constants.ts`
 * Notifications:
   - Create the new notification model in `packages/models/src/users/user-notification.model.ts`
   - Create the notification logic in `server/core/lib/notifier/shared`:
     + Email subject has a common prefix (defined by the admin in PeerTube configuration)
   - Add your notification to `server/core/lib/notifier/notifier.ts`
   - Create the email template in `server/core/assets/email-templates`:
     + A text version is automatically generated from the HTML
     + The template usually extends `../common/grettings` that already says "Hi" and "Cheers". You just have to write the title and the content blocks that will be inserted in the appropriate places in the HTML template
   - If you need to associate a new table with `userNotification`:
     + Associate the new table in `UserNotificationModel` (don't forget the index)
     + Add the object property in the API model definition (`packages/models/src/users/user-notification.model.ts`)
     + Add the object in `UserNotificationModel.toFormattedJSON`
     + Handle this new notification type in client (`UserNotificationsComponent`)
     + Handle the new object property in client model (`UserNotification`)
 * Tests:
   - Create your command class in `packages/server-commands/` that will wrap HTTP requests to your new endpoint
   - Add your command file in `index.ts` of current directory
   - Instantiate your command class in `packages/server-commands/src/server/core.ts`
   - Create your test file in `server/core/tests/api/check-params` to test middleware validators/authentification/user rights (offensive tests)
   - Add it to `server/core/tests/api/check-params/index.ts`
   - Create your test file in `server/core/tests/api` to test your new endpoints
   - Add it to `index.ts` of current directory
   - Add your notification test in `server/core/tests/api/notifications`
 * Update REST API documentation in `support/doc/api/openapi.yaml`
