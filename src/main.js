import constants from './constants.js';
import { PlayerSpotlight } from './applications/playerSpotlight.js';

// Helpers
const { renderTemplate } = foundry.applications.handlebars;

// Initialization logic
Hooks.once('init', async function () {
    console.debug('Initializing player spotlight module', { game, foundry });

    // Configure game settings
    game.settings.register(constants.MODULE_NAME, constants.DEFAULT_VIEW, {
        name: "fvtt-player-spotlight.viewMode.settings.title",
        hint: "fvtt-player-spotlight.viewMode.settings.description",
        scope: 'world',
        config: true,
        requiresReload: false,
        type: String,
        choices: {
            "session": "fvtt-player-spotlight.viewMode.session.title",
            "campaign": "fvtt-player-spotlight.viewMode.campaign.title"
        },
        default: "session"
    })

    game.settings.register(constants.MODULE_NAME, constants.DATA, {
        name: `${constants.MODULE_NAME}.${constants.DATA}`,
        scope: 'world',
        config: false, // Hide from settings UI
        requiresReload: false,
        type: new foundry.data.fields.ArrayField( // Array of
            new foundry.data.fields.SchemaField({
                date: new foundry.data.fields.IntegerSortField(), // Date epoch in UTC
                spotlights: new foundry.data.fields.ArrayField( // List of
                    new foundry.data.fields.ForeignDocumentField( // Document IDs refering to
                        foundry.documents.BaseUser // Users
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
            controls.tokens.tools[constants.MODULE_NAME] = {
                icon: 'fa-solid fa-person-rays',
                name: constants.MODULE_NAME,
                title: game.i18n.localize(`${constants.MODULE_NAME}.controlTitle`),
                visible: game.user.isGM,
                button: true,
                order: Object.keys(controls.tokens.tools).length, // Always at the bottom
                onChange(event, active) {
                    const current = foundry.applications.instances.get(constants.MODULE_NAME);
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
