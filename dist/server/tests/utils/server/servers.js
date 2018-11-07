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
const child_process_1 = require("child_process");
const path_1 = require("path");
const miscs_1 = require("../miscs/miscs");
const fs_extra_1 = require("fs-extra");
function flushAndRunMultipleServers(totalServers, configOverride) {
    let apps = [];
    let i = 0;
    return new Promise(res => {
        function anotherServerDone(serverNumber, app) {
            apps[serverNumber - 1] = app;
            i++;
            if (i === totalServers) {
                return res(apps);
            }
        }
        flushTests()
            .then(() => {
            for (let j = 1; j <= totalServers; j++) {
                runServer(j, configOverride).then(app => anotherServerDone(j, app));
            }
        });
    });
}
exports.flushAndRunMultipleServers = flushAndRunMultipleServers;
function flushTests() {
    return new Promise((res, rej) => {
        return child_process_1.exec('npm run clean:server:test', err => {
            if (err)
                return rej(err);
            return res();
        });
    });
}
exports.flushTests = flushTests;
function runServer(serverNumber, configOverride) {
    const server = {
        app: null,
        serverNumber: serverNumber,
        url: `http://localhost:${9000 + serverNumber}`,
        host: `localhost:${9000 + serverNumber}`,
        client: {
            id: null,
            secret: null
        },
        user: {
            username: null,
            password: null
        }
    };
    const serverRunString = {
        'Server listening': false
    };
    const key = 'Database peertube_test' + serverNumber + ' is ready';
    serverRunString[key] = false;
    const regexps = {
        client_id: 'Client id: (.+)',
        client_secret: 'Client secret: (.+)',
        user_username: 'Username: (.+)',
        user_password: 'User password: (.+)'
    };
    const env = Object.create(process.env);
    env['NODE_ENV'] = 'test';
    env['NODE_APP_INSTANCE'] = serverNumber.toString();
    if (configOverride !== undefined) {
        env['NODE_CONFIG'] = JSON.stringify(configOverride);
    }
    const options = {
        silent: true,
        env: env,
        detached: true
    };
    return new Promise(res => {
        server.app = child_process_1.fork(path_1.join(__dirname, '..', '..', '..', '..', 'dist', 'server.js'), [], options);
        server.app.stdout.on('data', function onStdout(data) {
            let dontContinue = false;
            for (const key of Object.keys(regexps)) {
                const regexp = regexps[key];
                const matches = data.toString().match(regexp);
                if (matches !== null) {
                    if (key === 'client_id')
                        server.client.id = matches[1];
                    else if (key === 'client_secret')
                        server.client.secret = matches[1];
                    else if (key === 'user_username')
                        server.user.username = matches[1];
                    else if (key === 'user_password')
                        server.user.password = matches[1];
                }
            }
            for (const key of Object.keys(serverRunString)) {
                if (data.toString().indexOf(key) !== -1)
                    serverRunString[key] = true;
                if (serverRunString[key] === false)
                    dontContinue = true;
            }
            if (dontContinue === true)
                return;
            server.app.stdout.removeListener('data', onStdout);
            res(server);
        });
    });
}
exports.runServer = runServer;
function reRunServer(server, configOverride) {
    return __awaiter(this, void 0, void 0, function* () {
        const newServer = yield runServer(server.serverNumber, configOverride);
        server.app = newServer.app;
        return server;
    });
}
exports.reRunServer = reRunServer;
function killallServers(servers) {
    for (const server of servers) {
        process.kill(-server.app.pid);
    }
}
exports.killallServers = killallServers;
function waitUntilLog(server, str, count = 1) {
    return __awaiter(this, void 0, void 0, function* () {
        const logfile = path_1.join(miscs_1.root(), 'test' + server.serverNumber, 'logs/peertube.log');
        while (true) {
            const buf = yield fs_extra_1.readFile(logfile);
            const matches = buf.toString().match(new RegExp(str, 'g'));
            if (matches && matches.length === count)
                return;
            yield miscs_1.wait(1000);
        }
    });
}
exports.waitUntilLog = waitUntilLog;
//# sourceMappingURL=servers.js.map