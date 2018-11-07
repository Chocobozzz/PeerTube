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
const index_1 = require("../index");
function getJobsList(url, accessToken, state) {
    const path = '/api/v1/jobs/' + state;
    return request(url)
        .get(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + accessToken)
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getJobsList = getJobsList;
function getJobsListPaginationAndSort(url, accessToken, state, start, count, sort) {
    const path = '/api/v1/jobs/' + state;
    return request(url)
        .get(path)
        .query({ start })
        .query({ count })
        .query({ sort })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + accessToken)
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getJobsListPaginationAndSort = getJobsListPaginationAndSort;
function waitJobs(serversArg) {
    return __awaiter(this, void 0, void 0, function* () {
        let servers;
        if (Array.isArray(serversArg) === false)
            servers = [serversArg];
        else
            servers = serversArg;
        const states = ['waiting', 'active', 'delayed'];
        const tasks = [];
        let pendingRequests;
        do {
            pendingRequests = false;
            for (const server of servers) {
                for (const state of states) {
                    const p = getJobsListPaginationAndSort(server.url, server.accessToken, state, 0, 10, '-createdAt')
                        .then(res => res.body.data)
                        .then((jobs) => jobs.filter(j => j.type !== 'videos-views'))
                        .then(jobs => {
                        if (jobs.length !== 0)
                            pendingRequests = true;
                    });
                    tasks.push(p);
                }
            }
            yield Promise.all(tasks);
            if (pendingRequests === false) {
                yield index_1.wait(1000);
                yield Promise.all(tasks);
            }
            if (pendingRequests) {
                yield index_1.wait(1000);
            }
        } while (pendingRequests);
    });
}
exports.waitJobs = waitJobs;
//# sourceMappingURL=jobs.js.map