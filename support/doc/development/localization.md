# Application localization documentation

Source files are in `client/src/locale` and translated files merged from [Weblate](https://weblate.framasoft.org/projects/peertube/).


## Generation

Will generate XLIFF base files for Angular (`angular.xlf`) and JSON files for the player (`player.en-US.json`) and the server (`server.en-US.json`).
Then, it will merge new translation keys into localized Angular files (`angular.fr-FR.xlf` etc).

```
npm run i18n:update
```


## Upload on Weblate

Nothing to do here, Github will automatically send a webhook to Weblate that will pull changes.


## Pull translation

 * First, save translations on Weblate so it commits changes.
 * Then, fetch these commits: `git fetch weblate && git merge weblate/develop`


## Support a new language

 * Add it to [/packages/models/i18n/i18n.ts](/packages/core-utils/src/i18n/i18n.ts)
 * Add it to [/scripts/build/client.sh](/scripts/build/client.sh)
 * Add it to [/client/angular.json](/client/angular.json)
 * Add it to [/scripts/i18n/update.sh](/scripts/i18n/update.sh)
 * Lock [weblate project](https://weblate.framasoft.org/projects/peertube)
 * Run `npm run i18n:update`
 * Build the application and check the new language correctly works
