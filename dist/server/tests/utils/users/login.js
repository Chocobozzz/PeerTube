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
const request = require("supertest");
function login(url, client, user, expectedStatus = 200) {
    const path = '/api/v1/users/token';
    const body = {
        client_id: client.id,
        client_secret: client.secret,
        username: user.username,
        password: user.password,
        response_type: 'code',
        grant_type: 'password',
        scope: 'upload'
    };
    return request(url)
        .post(path)
        .type('form')
        .send(body)
        .expect(expectedStatus);
}
exports.login = login;
function serverLogin(server) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield login(server.url, server.client, server.user, 200);
        return res.body.access_token;
    });
}
exports.serverLogin = serverLogin;
function userLogin(server, user, expectedStatus = 200) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield login(server.url, server.client, user, expectedStatus);
        return res.body.access_token;
    });
}
exports.userLogin = userLogin;
function setAccessTokensToServers(servers) {
    const tasks = [];
    for (const server of servers) {
        const p = serverLogin(server).then(t => server.accessToken = t);
        tasks.push(p);
    }
    return Promise.all(tasks);
}
exports.setAccessTokensToServers = setAccessTokensToServers;
