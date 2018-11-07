"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const repl = require("repl");
const path = require("path");
const _ = require("lodash");
const uuidv1 = require("uuid/v1");
const uuidv3 = require("uuid/v3");
const uuidv4 = require("uuid/v4");
const uuidv5 = require("uuid/v5");
const Sequelize = require("sequelize");
const YoutubeDL = require("youtube-dl");
const initializers_1 = require("../initializers");
const cli = require("../tools/cli");
const logger_1 = require("../helpers/logger");
const constants = require("../initializers/constants");
const modelsUtils = require("../models/utils");
const coreUtils = require("../helpers/core-utils");
const ffmpegUtils = require("../helpers/ffmpeg-utils");
const peertubeCryptoUtils = require("../helpers/peertube-crypto");
const signupUtils = require("../helpers/signup");
const utils = require("../helpers/utils");
const YoutubeDLUtils = require("../helpers/youtube-dl");
let versionCommitHash;
const start = () => __awaiter(this, void 0, void 0, function* () {
    yield initializers_1.initDatabaseModels(true);
    yield utils.getVersion().then((data) => {
        versionCommitHash = data;
    });
    const initContext = (replServer) => {
        return (context) => {
            const properties = {
                context, repl: replServer, env: process.env,
                lodash: _, path,
                uuidv1, uuidv3, uuidv4, uuidv5,
                cli, logger: logger_1.logger, constants,
                Sequelize, sequelizeTypescript: initializers_1.sequelizeTypescript, modelsUtils,
                models: initializers_1.sequelizeTypescript.models, transaction: initializers_1.sequelizeTypescript.transaction,
                query: initializers_1.sequelizeTypescript.query, queryInterface: initializers_1.sequelizeTypescript.getQueryInterface(),
                YoutubeDL,
                coreUtils, ffmpegUtils, peertubeCryptoUtils, signupUtils, utils, YoutubeDLUtils
            };
            for (let prop in properties) {
                Object.defineProperty(context, prop, {
                    configurable: false,
                    enumerable: true,
                    value: properties[prop]
                });
            }
        };
    };
    const replServer = repl.start({
        prompt: `PeerTube [${cli.version}] (${versionCommitHash})> `
    });
    initContext(replServer)(replServer.context);
    replServer.on('reset', initContext(replServer));
    const resetCommand = {
        help: 'Reset REPL',
        action() {
            this.write('.clear\n');
            this.displayPrompt();
        }
    };
    replServer.defineCommand('reset', resetCommand);
    replServer.defineCommand('r', resetCommand);
});
start().then((data) => {
}).catch((err) => {
    console.error(err);
});
//# sourceMappingURL=peertube-repl.js.map