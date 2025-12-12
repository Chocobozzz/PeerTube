#!/bin/bash

set -eu

defaultLanguage="en-US"

# Supported languages - using parallel arrays for Bash 3.2 compatibility (macOS default)
lang_keys=(ar sk is tr fa en vi hu th fi nl gd el es oc pt pt-PT sv pl ru zh-Hans zh-Hant fr ja eu ca gl cs hr eo de it uk sq tok nn nb kab)
lang_values=(ar sk-SK is tr-TR fa-IR en-US vi-VN hu-HU th-TH fi-FI nl-NL gd el-GR es-ES oc pt-BR pt-PT sv-SE pl-PL ru-RU zh-Hans-CN zh-Hant-TW fr-FR ja-JP eu-ES ca-ES gl-ES cs-CZ hr eo de-DE it-IT uk-UA sq tok nn nb-NO kab)


rm -rf ./client/dist

npm run build:embed

cd client

# Don't build other languages if --light arg is provided
if [ -z ${1+x} ] || ([ "$1" != "--light" ] && [ "$1" != "--analyze-bundle" ]); then
    additionalParams=""
    if [ ! -z ${1+x} ] && [ "$1" == "--source-map" ]; then
        additionalParams="--source-map=true"
    fi

    NODE_OPTIONS=--max_old_space_size=8192 node_modules/.bin/ng build --configuration production --output-path "dist/build" $additionalParams

    for i in "${!lang_keys[@]}"; do
        key="${lang_keys[$i]}"
        lang="${lang_values[$i]}"

        mv "dist/build/browser/$key" "dist/$lang"

        if [ "$lang" != "en-US" ]; then
            # Do not duplicate assets
            rm -r "./dist/$lang/assets"
        fi
    done

    mv "./dist/$defaultLanguage/assets" "./dist"

    rm -r "dist/build"
else
    additionalParams=""
    if [ ! -z ${1+x} ] && [ "$1" == "--analyze-bundle" ]; then
        additionalParams="--named-chunks=true --output-hashing=none"

        # For Vite
        export ANALYZE_BUNDLE=true
    fi

    NODE_OPTIONS=--max_old_space_size=8192 node_modules/.bin/ng build --localize=false --output-path "dist/$defaultLanguage/" \
                                                              --configuration production --stats-json $additionalParams
fi

# Copy runtime locales
cp -r "./src/locale" "./dist/locale"
