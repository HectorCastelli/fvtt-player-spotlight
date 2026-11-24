import { DATA, MODULE_NAME } from "./constants.js";

/**
 * @typedef {array<SpotlightSessionData>} SpotlightData
 */

/**
 * @typedef {object} SpotlightSessionData
 * @property {Number} date The number of ms elapsed since UTC Epoch (`Date.now()`)
 * @property {Array<string>} spotlights A list of spotlighted users (`BaseUser` IDs).
 */

class SpotlightTracker {
	#readDataCache;
	readData() {
		if (this.#readDataCache) {
			return this.#readDataCache;
		}
		const newData = game.settings.get(MODULE_NAME, DATA);
		this.#readDataCache = newData;
		return newData;
	}

	async #updateData(newData) {
		this.#readDataCache = undefined; // Empty data cache
		await game.settings.set(MODULE_NAME, DATA, newData).catch((updateError) => {
			throw new Error("Failed to update spotlight data", {
				cause: updateError,
			});
		});
		return newData;
	}

	/**
	 * Returns the latest session. Creates a new one if none exist.
	 *
	 * @param {SpotlightData} [spotlightData=this.#readData()] The data to use as base for this. Reads the most recent data by default
	 * @returns {SpotlightSessionData} the latest session data
	 */
	latestSession(spotlightData = this.readData()) {
		if (!spotlightData.length) {
			this.newSession(); // Start new session if needed
		}

		const latestSession = spotlightData.at(-1);
		return latestSession;
	}

	async trackSpotlight(userId, mode = "add") {
		const spotlightData = this.readData(); // Read most recent data

		if (!spotlightData.length) {
			this.newSession(); // Start new session if needed
		}

		const latestSession = this.latestSession(spotlightData); // Use already fetched data

		if (mode === "remove") {
			// Remove
			const lastSpotlightIndex = latestSession.spotlights.lastIndexOf(userId); // Find latest entry for this user
			if (lastSpotlightIndex >= 0) {
				latestSession.spotlights.splice(lastSpotlightIndex, 1); // Remove it
			}
		} else {
			// Add
			const userDocument = game.users.get(userId);
			if (!userId) {
				console.error(
					"Unable to locate userDocument for user",
					userId,
					userDocument,
				);
			}
			latestSession.spotlights.push(userDocument);
		}

		return this.#updateData(spotlightData);
	}

	/**
	 * Starts a new session with the current timestamp.
	 *
	 * @returns {SpotlightData} the full spotlight data after the new session is started.
	 */
	async newSession() {
		const spotlightData = this.readData();

		spotlightData.push({
			date: Date.now(),
			spotlights: [],
		});

		return this.#updateData(spotlightData);
	}
}

// Singleton
export const spotlightTracker = new SpotlightTracker();
