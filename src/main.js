import { PlayerSpotlight } from "./applications/playerSpotlight.js";
import {
	DATA,
	MODULE_NAME,
	NAME_MODE,
	NAME_MODES,
	PLAYER_FILTER,
	RESET_DATA,
	SORT_MODE,
	SORT_MODES,
} from "./constants.js";

// Initialization logic
Hooks.once("init", async () => {
	console.debug("Initializing player spotlight module", { game, foundry });

	// Configure game settings
	game.settings.register(MODULE_NAME, SORT_MODE, {
		name: `${MODULE_NAME}.${SORT_MODE}.title`,
		hint: `${MODULE_NAME}.${SORT_MODE}.description`,
		scope: "world",
		config: true,
		requiresReload: true,
		type: String,
		choices: {
			[SORT_MODES.QUEUE]: `${MODULE_NAME}.${SORT_MODE}.queue`,
			[SORT_MODES.STABLE]: `${MODULE_NAME}.${SORT_MODE}.stable`,
		},
		default: SORT_MODES.STABLE,
	});
	game.settings.register(MODULE_NAME, PLAYER_FILTER, {
		name: `${MODULE_NAME}.${PLAYER_FILTER}.title`,
		hint: `${MODULE_NAME}.${PLAYER_FILTER}.description`,
		scope: "world",
		config: true,
		requiresReload: true,
		type: Boolean,
		default: false,
	});
	game.settings.register(MODULE_NAME, NAME_MODE, {
		name: `${MODULE_NAME}.${NAME_MODE}.title`,
		hint: `${MODULE_NAME}.${NAME_MODE}.description`,
		scope: "world",
		config: true,
		requiresReload: true,
		type: String,
		choices: {
			[NAME_MODES.PLAYER]: `${MODULE_NAME}.${NAME_MODE}.player`,
			[NAME_MODES.CHARACTER]: `${MODULE_NAME}.${NAME_MODE}.character`,
			[NAME_MODES.MIXED]: `${MODULE_NAME}.${NAME_MODE}.mixed`,
		},
		default: NAME_MODES.PLAYER,
	});
	game.settings.register(MODULE_NAME, RESET_DATA, {
		name: `${MODULE_NAME}.${RESET_DATA}.title`,
		hint: `${MODULE_NAME}.${RESET_DATA}.description`,
		scope: "world",
		config: true,
		requiresReload: true,
		type: Boolean,
		default: false,
		onChange: async (value) => {
			if (value) {
				await game.settings.set(MODULE_NAME, DATA, []);
				await game.settings.set(MODULE_NAME, RESET_DATA, false);
			}
		},
	});

	// Prepare data storage
	game.settings.register(MODULE_NAME, DATA, {
		name: `${MODULE_NAME}.${DATA}`,
		scope: "world",
		config: false, // Hide from settings UI
		requiresReload: false,
		type: new foundry.data.fields.ArrayField(
			new foundry.data.fields.SchemaField({
				date: new foundry.data.fields.IntegerSortField(), // ms since UTC epoch
				spotlights: new foundry.data.fields.ArrayField(
					new foundry.data.fields.ForeignDocumentField(
						// `BaseUser`.id
						CONFIG.User.documentClass,
						{ idOnly: true },
					),
				),
			}),
		),
		default: [],
	});
});

Hooks.once("setup", async () => {
	if (game.user.isGM) {
		console.debug("This player is a GM");

		// Configure spotlight UI button
		Hooks.on("getSceneControlButtons", (controls) => {
			if (canvas.ready) {
				console.debug("Attaching UI to control pane", { controls });
				controls.tokens.tools[MODULE_NAME] = {
					icon: "fa-solid fa-person-rays",
					name: MODULE_NAME,
					title: game.i18n.localize(`${MODULE_NAME}.controlTitle`),
					visible: game.user.isGM,
					button: true,
					order: Object.keys(controls.tokens.tools).length, // Always at the bottom
					onChange(event, active) {
						console.debug("Spotlight activated", { event, active });

						const current = foundry.applications.instances.get(MODULE_NAME);
						if (current) {
							current.close();
							return;
						}
						// Show the tracker
						new PlayerSpotlight().render({ force: true });
					},
				};
			} else {
				console.warn("No scene is loaded. The spotlight UI can't be shown");
			}

			// TODO: create a stand-alone button next to the player bar instead
		});
	}
});
