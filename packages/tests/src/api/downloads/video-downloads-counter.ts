/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { PeerTubeServer, waitJobs } from "@peertube/peertube-server-commands"
import {
	prepareDownloadsServer,
	processDownloadsStats,
} from "@tests/shared/downloads.js"
import { Promise } from "bluebird"
import { expect } from "chai"

describe("Test video downloads counters", function() {
	let server: PeerTubeServer

	before(async function() {
		this.timeout(120000)

		server = await prepareDownloadsServer()

		this.timeout(120000)
	})

	async function upload(): Promise < string > {
		return new Promise(async (resolve) => {
			const { uuid } = await server.videos.quickUpload({ name: "video" })
			await waitJobs(server)
			resolve(uuid)
		})
	}

	it("Should count downloads", async function() {
		const videoId = await upload()
		const video = await server.videos.getWithToken({ id: videoId })
		const videoFileIds = [ video.files[0].id ]

		await server.videos.generateDownload({
			videoId,
			videoFileIds,
		})
		await processDownloadsStats([ server ])

		expect((await server.videos.get({ id: videoId })).downloads).to.equal(1)
	})

	it("Should return time-series for downloads stats", async function() {
		const videoId = await upload()
		const video = await server.videos.getWithToken({ id: videoId })
		const videoFileIds = [ video.files[0].id ]

		await server.videos.generateDownload({
			videoId,
			videoFileIds,
		})
		await processDownloadsStats([ server ])

		const startDate = new Date()
		startDate.setSeconds(0)
		startDate.setMilliseconds(0)

		const res = await server.videoStats.getTimeserieStats({
			videoId,
			metric: "downloads",
		})
		const count = res.data.find(
			(e) => e.date === startDate.toISOString(),
		).value

		expect(count).to.equal(1)
	})
})
