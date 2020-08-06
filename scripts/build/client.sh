#!/bin/bash

set -eu

declare -A languages

pre_build_hook () {
  mkdir "./src/pending_locale" > /dev/null || true
  mv ./src/locale/angular.*.xlf "./src/pending_locale"

  if [ ! -z ${1+x} ]; then
    mv "./src/pending_locale/angular.$1.xlf" "./src/locale"
  fi
}

post_build_hook () {
  mv ./src/pending_locale/* "./src/locale"
  rmdir "./src/pending_locale/"
}

# Previous build failed
if [ ! -f "client/src/locale/angular.fr-FR.xlf" ]; then
    git checkout -- client/src/locale/
    rm -r client/src/pending_locale
fi

cd client

rm -rf ./dist ./compiled

pre_build_hook

additionalParams=""
if [ ! -z ${1+x} ] && [ "$1" == "--analyze-bundle" ]; then
    additionalParams="--namedChunks=true --outputHashing=none"
    export ANALYZE_BUNDLE=true
fi


defaultLanguage="en-US"
npm run ng build -- --output-path "dist/$defaultLanguage/" --deploy-url "/client/$defaultLanguage/" --prod --stats-json $additionalParams
mv "./dist/$defaultLanguage/assets" "./dist"
mv "./dist/$defaultLanguage/manifest.webmanifest" "./dist/manifest.webmanifest"

post_build_hook

# Don't build other languages if --light arg is provided
if [ -z ${1+x} ] || ([ "$1" != "--light" ] && [ "$1" != "--analyze-bundle" ]); then
    if [ ! -z ${1+x} ] && [ "$1" == "--light-hu" ]; then
        languages=(["hu"]="hu-HU")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-ar" ]; then
        languages=(["ar"]="ar")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-vi" ]; then
        languages=(["vi"]="vi-VN")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-kab" ]; then
        languages=(["kab"]="kab")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-th" ]; then
        languages=(["th"]="th-TH")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-fi" ]; then
        languages=(["fi"]="fi-FI")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-nl" ]; then
        languages=(["nl"]="nl-NL")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-gd" ]; then
        languages=(["gd"]="gd")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-el" ]; then
        languages=(["el"]="el-GR")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-es" ]; then
        languages=(["es"]="es-ES")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-oc" ]; then
        languages=(["oc"]="oc")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-pt" ]; then
        languages=(["pt"]="pt-BR")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-pt-PT" ]; then
        languages=(["pt-PT"]="pt-PT")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-sv" ]; then
        languages=(["sv"]="sv-SE")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-pl" ]; then
        languages=(["pl"]="pl-PL")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-ru" ]; then
        languages=(["ru"]="ru-RU")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-zh-Hans" ]; then
        languages=(["zh-Hans"]="zh-Hans-CN")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-zh-Hant" ]; then
        languages=(["zh-Hant"]="zh-Hant-TW")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-fr" ]; then
        languages=(["fr"]="fr-FR")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-ja" ]; then
        languages=(["ja"]="ja-JP")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-eu" ]; then
        languages=(["eu"]="eu-ES")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-ca" ]; then
        languages=(["ca"]="ca-ES")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-cs" ]; then
        languages=(["cs"]="cs-CZ")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-eo" ]; then
        languages=(["eo"]="eo")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-de" ]; then
        languages=(["de"]="de-DE")
    elif [ ! -z ${1+x} ] && [ "$1" == "--light-it" ]; then
        languages=(["it"]="it-IT")
    else
        # Supported languages
        languages=(
            ["ar"]="ar"
            ["vi"]="vi-VN"
            ["hu"]="hu-HU"
            ["th"]="th-TH"
            ["fi"]="fi-FI"
            ["nl"]="nl-NL"
            ["gd"]="gd"
            ["el"]="el-GR"
            ["es"]="es-ES"
            ["oc"]="oc"
            ["pt"]="pt-BR"
            ["pt-PT"]="pt-PT"
            ["sv"]="sv-SE"
            ["pl"]="pl-PL"
            ["ru"]="ru-RU"
            ["zh-Hans"]="zh-Hans-CN"
            ["zh-Hant"]="zh-Hant-TW"
            ["fr"]="fr-FR"
            ["ja"]="ja-JP"
            ["eu"]="eu-ES"
            ["ca"]="ca-ES"
            ["cs"]="cs-CZ"
            ["eo"]="eo"
            ["de"]="de-DE"
            ["it"]="it-IT"
            ["kab"]="kab"
        )
    fi

    for key in "${!languages[@]}"; do
        lang=${languages[$key]}

        # TODO: remove when the project will use runtime translations
        pre_build_hook "$lang"

        npm run ng build -- --prod --configuration="$lang" --output-path "dist/build"

        # If --localize is not used
        mv "dist/build/$key" "dist/$lang"
        rmdir "dist/build"

        # If --localize is used
        # if [ ! "$lang" = "$key" ]; then
        #   mv "dist/$key" "dist/$lang"
        # fi

        # Do not duplicate assets
        rm -r "./dist/$lang/assets"

        # TODO: remove when the project will use runtime translations
        post_build_hook
    done
fi

cd ../ && npm run build:embed && cd client/

# Copy runtime locales
cp -r "./src/locale" "./dist/locale"
