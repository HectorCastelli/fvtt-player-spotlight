import constants from '../constants.js';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PlayerSpotlight extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: constants.MODULE_NAME,
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
            startSession: this.#startSession,
            spotlight: this.#spotlight,
        }
    }

    static PARTS = {
        tabs: {
            template: 'templates/generic/tab-navigation.hbs', // Foundry-provided generic template
        },
        session: {
            template: `modules/${constants.MODULE_NAME}/src/templates/session.hbs`,
        },
        campaign: {
            template: `modules/${constants.MODULE_NAME}/src/templates/campaign.hbs`,
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
                        label: 'fvtt-player-spotlight.viewMode.session.title',
                        tooltip: 'fvtt-player-spotlight.viewMode.session.description',
                        icon: 'fa-solid fa-calendar-day',
                    },
                    {
                        id: 'campaign',
                        label: 'fvtt-player-spotlight.viewMode.campaign.title',
                        tooltip: 'fvtt-player-spotlight.viewMode.campaign.description',
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
        const defaultTab = game.settings.get(constants.MODULE_NAME, constants.DEFAULT_VIEW);
        this.changeTab(defaultTab, 'sheet', { force: true });
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        return context;
    }

    static async #startSession(...args) {
        console.log({ args })
    }

    static async #spotlight(event, element) {
        console.log({ event, element });
    }
}