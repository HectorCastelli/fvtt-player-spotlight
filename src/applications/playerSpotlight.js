import { MODULE_NAME, DATA, SORT_MODE, SORT_MODES, SESSION_AUTO_START, PLAYER_FILTER, NAME_MODE, NAME_MODES } from '../constants.js';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PlayerSpotlight extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: MODULE_NAME,
        tag: 'div',
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
        }
    }

    static PARTS = {
        session: {
            template: `modules/${MODULE_NAME}/src/templates/session.hbs`,
        },
        spotlight: {
            template: `modules/${MODULE_NAME}/src/templates/spotlight.hbs`,
        },
    }

    #sortMode;
    #nameMode;
    #activeFilter;

    constructor(options = {}) {
        super(options);

        this.#sortMode = game.settings.get(MODULE_NAME, SORT_MODE);
        this.#nameMode = game.settings.get(MODULE_NAME, NAME_MODE);
        this.#activeFilter = game.settings.get(MODULE_NAME, PLAYER_FILTER) ?? false;

        // Auto-start a new session if the setting is enabled and the last session is from a different day
        if (game.settings.get(MODULE_NAME, SESSION_AUTO_START)) {
            const spotlightData = game.settings.get(MODULE_NAME, DATA);
            const latestSession = spotlightData.at(-1);
            console.debug('Auto-starting new session if needed', { latestSession: latestSession ? new Date(latestSession.date).toDateString() : undefined, today: new Date().toDateString() });
            if (latestSession && new Date(latestSession.date).toDateString() !== new Date().toDateString()) {
                void this.#newSession();
            }
        }

        // Watch player connection events
        if (this.#activeFilter) {
            Hooks.on('userConnected', function (user, connected) {
                PlayerSpotlight.refreshCurrentUI();
            });
        }
    }

    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);

        // Bind right-click for spotlight to the same action
        htmlElement.querySelectorAll("[data-action=spotlight]").forEach(element => {
            element.addEventListener("contextmenu", (event) => {
                event.preventDefault(); // Prevent native browser context menu
                const actionName = element.dataset.action;
                const handler = this.options.actions[actionName];
                if (handler) { handler.call(this, event, element); }
            });
        });
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        context.spotlight = this.#getContextData();

        return context;
    }

    #getContextData(spotlightData = game.settings.get(MODULE_NAME, DATA)) {
        console.debug('Preparing context data for player spotlight', { spotlightData, activeFilter: this.#activeFilter, sortMode: this.#sortMode, nameMode: this.#nameMode });
        const result = {};

        const latestSession = spotlightData.at(-1);

        // Setup visible users
        const { users } = game;
        console.log({ players: users.players });
        result.players = users.players.map(({ id, name, active, character }) => {
            const playerName = name;
            const characterName = character.name; // TODO: study more systems and find fallbacks

            let entryName;
            switch (this.#nameMode) {
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
                visible: this.#activeFilter ? active : true,
            }
        });

        result.sortMode = this.#sortMode;
        if (this.#sortMode === SORT_MODES.STABLE) {
            // Sort players by their names, alphabetically.
            result.players.sort((a, b) => a.name.localeCompare(b.name));
        }

        if (latestSession) {
            result.session = {
                current: spotlightData.at(-1).date,
                currentDate: this.#prepareDate(spotlightData.at(-1).date),
                lastPlayer: spotlightData.at(-1).spotlights.at(-1),
                counts: Object.fromEntries(
                    result.players.map(player => [player.id, latestSession.spotlights.filter(e => e === player.id).length])
                ),
            };
        }

        console.debug('Prepared context data for player spotlight', { result });
        return result;
    }

    /**
     * Prepares a date epoch (number) for display in the UI, using the user's locale. 
     */
    #prepareDate(dateEpoch = Date.now()) {
        return new Date(dateEpoch).toLocaleDateString(
            undefined, // Use the user's locale
            { // Format as DD/MM/YY (or MM/DD/YY depending on locale)
                year: '2-digit',
                month: '2-digit',
                day: '2-digit',
            }
        );
    }

    async #newSession() {
        const spotlightData = game.settings.get(MODULE_NAME, DATA);

        spotlightData.push({
            date: Date.now(),
            spotlights: []
        });

        return game.settings.set(MODULE_NAME, DATA, spotlightData);
    }

    /**
     * Refreshes the UI to reflect the current state of the data.
     * 
     * This is an alternative to `this.render()`.
     * The main advantage is that this will update the UI without re-rendering the entire window, allowing CSS transitions and animations to play as expected.
     */
    _refreshUI() {
        console.debug('Refreshing Spotlight UI');
        const contextData = this.#getContextData();

        const spotlightList = this.element.querySelector('.spotlight-list');
        for (const child of spotlightList.children) {
            child.dataset.spotlightLatest = (child.dataset.userId === contextData.session.lastPlayer);
            child.dataset.spotlightCount = contextData.session.counts[child.dataset.userId];
            if (this.#activeFilter) {
                child.dataset.spotlightVisible = contextData.players.find(p => p.id === child.dataset.userId)?.visible;
            }
        }

        const sessionDateElement = this.element.querySelector('[data-spotlight-session-date]');
        if (sessionDateElement) {
            sessionDateElement.textContent = this.#prepareDate(contextData.session.currentDate);
        }
    }

    static refreshCurrentUI() {
        const instance = foundry.applications.instances.get(MODULE_NAME);
        if (instance) {
            instance._refreshUI();
        }
    }

    static async #startSession(event, element) {
        await this.#newSession();
        this._refreshUI();
    }

    static async #spotlight(event, element) {
        const userId = element.dataset.userId;
        if (!userId) {
            console.error('Unable to locate userId', userId);
        }

        const userDocument = game.users.get(userId);
        if (!userId) {
            console.error('Unable to locate userDocument for user', userId, userDocument);
        }

        // Read the latest data from storage to avoid overwriting changes made by other clients
        const spotlightData = game.settings.get(MODULE_NAME, DATA);

        // Start a new session if none exists
        if (!spotlightData.length) {
            this.#newSession();
        }
        const latestSession = spotlightData.at(-1);

        if (event.type === 'contextmenu' || event.button === 2) {
            const lastSpotlightIndex = latestSession.spotlights.findLastIndex(e => e === userId);
            if (lastSpotlightIndex >= 0) {
                latestSession.spotlights.splice(lastSpotlightIndex, 1); // Remove last occurrence for this user
            }
        } else {
            latestSession.spotlights.push(userDocument);
        }

        // Update the stored data with the modified values without blocking
        void game.settings.set(MODULE_NAME, DATA, spotlightData).catch(updateError => {
            console.error('Failed to update spotlight data', updateError);
        })

        this._refreshUI();
    }
}