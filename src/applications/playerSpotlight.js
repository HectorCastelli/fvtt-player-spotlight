import {
	CHARACTER_NAME_FALLBACK,
	MODULE_NAME,
	NAME_MODE,
	NAME_MODES,
	PLAYER_FILTER,
	SORT_MODE,
	SORT_MODES,
} from "../constants.js";
import { spotlightTracker } from "../tracker.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PlayerSpotlight extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		id: MODULE_NAME,
		tag: "div",
		window: {
			icon: "fa-solid fa-person-rays",
			resizable: true,
			title: "fvtt-player-spotlight.controlTitle",
		},
		position: {
			width: 300,
			height: 250,
		},
		actions: {
			spotlight: this.#spotlight,
			startSession: this.#startSession,
		},
	};

	static PARTS = {
		session: {
			template: `modules/${MODULE_NAME}/src/templates/session.hbs`,
		},
		spotlight: {
			template: `modules/${MODULE_NAME}/src/templates/spotlight.hbs`,
		},
	};

	constructor(options = {}) {
		super(options);
		this.#setupUserConnectionHook();
	}

	_attachPartListeners(partId, htmlElement, options) {
		super._attachPartListeners(partId, htmlElement, options);

		// Bind right-click for spotlight to the same action
		htmlElement
			.querySelectorAll("[data-action=spotlight]")
			.forEach((element) => {
				element.addEventListener("contextmenu", (event) => {
					event.preventDefault(); // Prevent native browser context menu
					const actionName = element.dataset.action;
					const handler = this.options.actions[actionName];
					if (handler) {
						handler.call(this, event, element);
					}
				});
			});
	}

	async _prepareContext(options) {
		const context = await super._prepareContext(options);

		context.spotlight = this.#getContextData();

		return context;
	}

	/**
	 * If configured to only display active users, add a hook to track user connection/disconnections and refresh the UI.
	 */
	#setupUserConnectionHook() {
		if (this.activeFilter) {
			console.debug("Spotlight will watch user connections");
			Hooks.on("userConnected", (_user, _connected) => {
				PlayerSpotlight.refreshCurrentUI(); // Refresh the full UI to ensure consistency
			});
		}
	}

	get sortMode() {
		return game.settings.get(MODULE_NAME, SORT_MODE);
	}

	get nameMode() {
		return game.settings.get(MODULE_NAME, NAME_MODE);
	}

	get activeFilter() {
		return game.settings.get(MODULE_NAME, PLAYER_FILTER) ?? false;
	}

	/**
	 * @typedef PlayerData
	 *
	 * @property {string} id The `BaseUser`.id
	 * @property {string} name The formatted name of the user, following NAME_MODE preferences
	 * @property {boolean} visible Whether to show or not this user's data. Follows PLAYER_FILTER, otherwise defaults to true.
	 */

	/**
	 * Fetch, prepare, then sort player data for display
	 * @returns {array<PlayerData>} The resulting data
	 */
	#getPlayerData() {
		const { users } = game;
		const { players } = users;
		console.debug("User data for spotlights", { players });
		const data = players.map(({ id, name, active, character }) => {
			const playerName = name;
			const characterName =
				character?.name ??
				game.i18n.localize(
					`${MODULE_NAME}.${NAME_MODE}.${CHARACTER_NAME_FALLBACK}`,
				); // TODO: study more systems and find fallbacks

			let entryName;
			switch (this.nameMode) {
				case NAME_MODES.PLAYER:
					entryName = playerName;
					break;
				case NAME_MODES.CHARACTER:
					entryName = characterName;
					break;
				case NAME_MODES.MIXED:
					entryName = `${characterName} (${playerName})`;
					break;
			}

			return {
				id,
				name: entryName,
				visible: this.activeFilter ? active : true, // Always visible if active filter is not true
			};
		});

		if (this.sortMode === SORT_MODES.STABLE) {
			// Sort players by their names, alphabetically.
			data.sort((a, b) => a.name.localeCompare(b.name));
		}

		return data;
	}

	#getContextData() {
		console.debug("Preparing context data for player spotlight", {
			activeFilter: this.activeFilter,
			sortMode: this.sortMode,
			nameMode: this.nameMode,
		});
		const latestSession = spotlightTracker.latestSession();

		const playerData = this.#getPlayerData();

		const result = {
			players: playerData,
			session: {
				current: latestSession.date,
				currentDate: this.#prepareDate(latestSession.date),
				lastPlayer: latestSession.spotlights.at(-1),
				counts: Object.fromEntries(
					playerData.map((player) => [
						player.id,
						latestSession.spotlights.filter((e) => e === player.id).length,
					]),
				),
			},
		};

		console.debug("Prepared context data for player spotlight", { result });
		return result;
	}

	/**
	 * Prepares a date epoch (number) for display in the UI, using the user's locale.
	 */
	#prepareDate(dateEpoch = Date.now()) {
		return new Date(dateEpoch).toLocaleDateString(
			undefined, // Use the user's locale
			{
				// Format as DD/MM/YY (or MM/DD/YY depending on locale)
				year: "2-digit",
				month: "2-digit",
				day: "2-digit",
			},
		);
	}

	/**
	 * Refreshes the UI to reflect the current state of the data.
	 *
	 * This is an alternative to `this.render()`.
	 * The main advantage is that this will update the UI without re-rendering the entire window, allowing CSS transitions and animations to play as expected.
	 */
	_refreshUI() {
		console.debug("Refreshing Spotlight UI");
		const contextData = this.#getContextData();

		const spotlightList = this.element.querySelector(".spotlight-list");
		for (const child of spotlightList.children) {
			child.dataset.spotlightLatest =
				child.dataset.userId === contextData.session.lastPlayer;
			child.dataset.spotlightCount =
				contextData.session.counts[child.dataset.userId];
			if (this.activeFilter) {
				child.dataset.spotlightVisible = contextData.players.find(
					(p) => p.id === child.dataset.userId,
				)?.visible;
			}
		}

		const sessionDateElement = this.element.querySelector(
			"[data-spotlight-session-date]",
		);
		if (sessionDateElement) {
			sessionDateElement.textContent = this.#prepareDate(
				contextData.session.current,
			);
		}
	}

	/**
	 * Static helper that calls the partial UI refresh window if it is available
	 */
	static refreshCurrentUI() {
		const instance = foundry.applications.instances.get(MODULE_NAME);
		if (instance) {
			instance._refreshUI();
		} else {
			console.warn(
				"PlayerSpotlight window was requested a refresh but is not instantiated",
			);
		}
	}

	//#region Foundry `data-action` UI Hooks
	static async #startSession(_event, _element) {
		spotlightTracker.newSession();
		PlayerSpotlight.refreshCurrentUI();
	}

	static async #spotlight(event, element) {
		const userId = element.dataset.userId;
		if (!userId) {
			console.error("Unable to locate userId", userId);
		}

		await spotlightTracker.trackSpotlight(
			userId,
			// Right click to remove
			event.type === "contextmenu" || event.button === 2 ? "remove" : "add",
		);
		PlayerSpotlight.refreshCurrentUI();
	}
	//#endregion
}
