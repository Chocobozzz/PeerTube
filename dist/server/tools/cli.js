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
const config = require('application-config')('PeerTube/CLI');
exports.config = config;
const netrc = require('netrc-parser').default;
exports.netrc = netrc;
const version = require('../../../package.json').version;
exports.version = version;
let settings = {
    remotes: [],
    default: 0
};
exports.settings = settings;
function getSettings() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((res, rej) => {
            let settings = {
                remotes: [],
                default: 0
            };
            config.read((err, data) => {
                if (err) {
                    return rej(err);
                }
                return res(Object.keys(data).length === 0 ? settings : data);
            });
        });
    });
}
exports.getSettings = getSettings;
function writeSettings(settings) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((res, rej) => {
            config.write(settings, function (err) {
                if (err) {
                    return rej(err);
                }
                return res();
            });
        });
    });
}
exports.writeSettings = writeSettings;
netrc.loadSync();
