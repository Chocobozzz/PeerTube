import {
	createSingleServer,
	PeerTubeServer,
	setAccessTokensToServers,
	setDefaultVideoChannel,
	waitJobs,
} from "@peertube/peertube-server-commands"

async function prepareDownloadsServer() {
	const server = await createSingleServer(1, {})
	await setAccessTokensToServers([ server ])
	await setDefaultVideoChannel([ server ])

	await server.config.enableMinimumTranscoding()

	return server
}

async function processDownloadsStats(servers: PeerTubeServer[]) {
	for (const server of servers) {
		await server.debug.sendCommand({
			body: { command: "process-video-downloads" },
		})
	}

	await waitJobs(servers)
}

export { prepareDownloadsServer, processDownloadsStats }
