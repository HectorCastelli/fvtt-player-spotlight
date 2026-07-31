import { MODULE_NAME, DATA_MODE, SORT_MODE, DATA } from './constants.js';
import { PlayerSpotlight } from './applications/playerSpotlight.js';

// Helpers
const { renderTemplate } = foundry.applications.handlebars;

// Initialization logic
Hooks.once('init', async function () {
    console.debug('Initializing player spotlight module', { game, foundry });

    // Configure game settings
    game.settings.register(MODULE_NAME, DATA_MODE, {
        name: "fvtt-player-spotlight.data.settings.title",
        hint: "fvtt-player-spotlight.data.settings.description",
        scope: 'world',
        config: true,
        requiresReload: false,
        type: String,
        choices: {
            "session": "fvtt-player-spotlight.data.session.title",
            "campaign": "fvtt-player-spotlight.data.campaign.title"
        },
        default: "session"
    });


    // Prepare data storage
    game.settings.register(MODULE_NAME, DATA, {
        name: `${MODULE_NAME}.${DATA}`,
        scope: 'world',
        config: false, // Hide from settings UI
        requiresReload: false,
        /**
         * This is an array of objects with:
         *  - `date`: `Date.getTime()`
         *  - `spotlights`: Array of `BaseUser` IDs
         */
        type: new foundry.data.fields.ArrayField(
            new foundry.data.fields.SchemaField({
                date: new foundry.data.fields.IntegerSortField(),
                spotlights: new foundry.data.fields.ArrayField(
                    new foundry.data.fields.ForeignDocumentField(
                        foundry.documents.BaseUser
                    )
                )
            })
        ),
        default: [],
    })
});

Hooks.once('setup', async function () {
    console.log({ game, CONFIG });

    if (game.user.isGM) {
        console.debug('This player is a GM');

        // Configure player list controls
        Hooks.on('getSceneControlButtons', function (controls) {
            // TODO: create a stand-alone button next to the player bar instead
            controls.tokens.tools[MODULE_NAME] = {
                icon: 'fa-solid fa-person-rays',
                name: MODULE_NAME,
                title: game.i18n.localize(`${MODULE_NAME}.controlTitle`),
                visible: game.user.isGM,
                button: true,
                order: Object.keys(controls.tokens.tools).length, // Always at the bottom
                onChange(event, active) {
                    const current = foundry.applications.instances.get(MODULE_NAME);
                    if (current) {
                        current?.close();
                        return;
                    }
                    // Show the tracker
                    new PlayerSpotlight().render({ force: true });
                }
            }
        });
    }
});
