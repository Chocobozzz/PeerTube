# Application localization documentation

Source files are in `client/src/locale/source` and translated files pulled from [Zanata](https://trad.framasoft.org/zanata/iteration/view/peertube/develop/languages/fr?dswid=-1605) in `client/src/locale/target`.

## Generation

Will generate XLIFF files for Angular and escape inner elements in `source` tag because Zanata does not support them.

This script will create `player_en_US.xml` XLIFF file using custom strings (VideoJS plugins) and strings from `videojs_en_US.json` file.

It will also create `server_en_US.xml` and `iso639_en_US.xml` XLIFF file using server strings and custom strings (defined inside the script, we did not find a way to extract them from TypeScript server files).

```
$ npm run i18n:generate
```

## Upload on Zanata

Push source source files (en-US) on Zanata:

```
$ zanata-cli push
```

## Pull translation

Pull XLIFF files from Zanata, and unescape them (so we retrieve inner elements in `source` tag, used by Angular).
A hook converts `player` and `server`, `iso639` translation files to JSON (needed by Video.JS, and our application to have efficient runtime translation).
Then, `iso639` files will be merged in `server` files (so we have only one JSON file to serve server translations).

```
$ zanata-cli pull
```
