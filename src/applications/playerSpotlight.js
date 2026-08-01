import { MODULE_NAME, DATA_MODE, DATA } from '../constants.js';
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
            width: 400,
            height: 'auto',
        },
        actions: {
            spotlight: this.#spotlight,
        }
    }

    static PARTS = {
        tabs: {
            template: 'templates/generic/tab-navigation.hbs', // Foundry-provided generic template
        },
        session: {
            template: `modules/${MODULE_NAME}/src/templates/session.hbs`,
        },
        campaign: {
            template: `modules/${MODULE_NAME}/src/templates/campaign.hbs`,
        },
    }

    static TABS =
        {
            sheet: {
                initial: '', // This is overwritten by the firstRender
                labelPrefix: null,
                tabs: [
                    {
                        id: 'session',
                        label: 'fvtt-player-spotlight.data.session.title',
                        tooltip: 'fvtt-player-spotlight.data.session.description',
                        icon: 'fa-solid fa-calendar-day',
                    },
                    {
                        id: 'campaign',
                        label: 'fvtt-player-spotlight.data.campaign.title',
                        tooltip: 'fvtt-player-spotlight.data.campaign.description',
                        icon: 'fa-solid fa-calendar-days',
                    }
                ]
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
                if (handler) handler.call(this, event, element);
            });
        });
    }


    async _onFirstRender(context, options) {
        const defaultTab = game.settings.get(MODULE_NAME, DATA_MODE);
        this.changeTab(defaultTab, 'sheet', { force: true });
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        context.spotlight = this.#getContextData();

        return context;
    }

    #getContextData(spotlightData = game.settings.get(MODULE_NAME, DATA)) {
        const result = {};

        const { users } = game;
        result.players = users.players;

        const latestSession = spotlightData.at(-1);
        if (latestSession) {
            result.session = {
                current: spotlightData.at(-1).date,
                lastPlayer: spotlightData.at(-1).spotlights.at(-1),
                counts: Object.fromEntries(
                    result.players.map(player => [player.id, latestSession.spotlights.filter(e => e === player.id).length])
                ),
            };

            result.campaign = {};
        }

        return result;
    }

    async startSession() {
        const spotlightData = game.settings.get(MODULE_NAME, DATA);

        spotlightData.push({
            date: Date.now(),
            spotlights: []
        });

        return game.settings.set(MODULE_NAME, DATA, spotlightData);
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

        const spotlightData = game.settings.get(MODULE_NAME, DATA);
        const latestSession = spotlightData.at(-1);

        if (!latestSession) {
            // Start a new session if none exists
            this.startSession();
        }

        if (event.type === 'contextmenu' || event.button === 2) {
            const lastSpotlightIndex = latestSession.spotlights.findLastIndex(e => e === userId);
            if (lastSpotlightIndex) {
                latestSession.spotlights.splice(lastSpotlightIndex, 1); // Remove last one
            }
        } else {
            latestSession.spotlights.push(userDocument);
        }

        console.debug(spotlightData);
        // Update the stored data with the modified values without blocking
        void game.settings.set(MODULE_NAME, DATA, spotlightData).catch(updateError => {
            console.error('Failed to update spotlight data', updateError);
        })

        // Refresh the current UI to reflect the changes
        const contextData = this.#getContextData(spotlightData); // Use local (modified) version of data

        const spotlightList = element.parentNode;
        for (const child of spotlightList.children) {
            child.dataset.spotlightLatest = (child.dataset.userId === contextData.session.lastPlayer);
            child.dataset.spotlightCount = contextData.session.counts[child.dataset.userId];
        }
    }
}