# fvtt-player-spotlight

A foundryVTT module that helps GMs track who is getting the spotlight during sessions and campaigns.

## Installation:

You can use the url `https://github.com/HectorCastelli/fvtt-player-spotlight/releases/latest/download/module.json` to install this module on your Foundry instance.

## Features

> Note: Not all features listed here are available.
>
> Features that are planned but not yet implemented are noted by a `🔜` symbol

### Keep an eye on the spotlight

Click the spotlight icon on the right of the player list, to display the `Spotlight Tracker` window.

![Spotlight button shown in the token tool bar](./assets/activation.png)

Once open, you will have access to an up-to-date view on how the spotlight is being shared across your players:

![Spotlight window showing the list of players](./assets/window.png)

#### 🔜 Tracking your game

We offer two view modes that you can toggle:

- `Campaign Mode`: shows all the data available. Highlighting the portion that corresponds to the current session. 
- `Session Mode`: shows only the data for the current session.

<!-- TODO: show screenshot of this feature. -->

#### Choose a sorting mode

To help you determine who should receive the spotlight next, we offer two modes:

- `Queue mode`: Whenever a player receives a spotlight, it will be moved to the end of the list. This means that players at the start of the list are the ones that should be considered for a spotlight next!
- `Stable mode`: Players are sorted by their names, so clicking them will not reorder the list. In this case, you can track the overall count of spotlights, and watch the `spotlight` icon to see who received the spotlight last.

| Queue mode | Stable Mode |
| :-: | :-: |
| [Queue mode in action](./assets/queue-mode.mp4) | [Stable mode in action](./assets/queue-mode.mp4) |

### Track sessions

When you start a new session, you can press the `New session` button. This will start a new, clean, tracker for the current session.

Optionally, this can be done automatically when the date changes.

### Track when you spotlight a player 

You can *left-click* a player card to indicate they received a spotlight, or *right-click* them to remove or undo a spotlight.

Clicking a player card will always register the spotlight on the most recently created session.

### 🔜 Show and hide players quickly

If you share a world between multiple groups, you can show and hide specific players quickly, reducing the visual noise and keeping the interface clean for you.

To do so, you can *right-click* on the players list and `Track spotlight`/`Hide spotlight` for the current session.

#### 🔜 Create group templates

If you frequently switch between groups, you can create **Group templates** and quickly activate them.

This makes tracking and hiding players a one-click action instead of going manually thru each one.

## Contributing

This project is fully open source and open to external contributions.

You can contribute by reporting bugs, suggesting features, and submitting Pull Requests with improvements and fixes.

The working language is English, even if the module supports other languages during runtime.

### AI use

This project does **NOT** accept AI-generated content, nor code.

All code and content contributions must comply with the [FoundryVTT AI Content Policy](https://foundryvtt.com/article/ai-policy/) definition for "Zero AI".

AI tools may be used to report bugs or requests features, for the purpose of translation or rewriting.
In these cases, the use of AI assistance (where the majority of the work is performed by a human, and any AI-generated output is validated by a human) is allowed as long as a disclaimer is added at the time of reporting.
Submissions by AI systems without human supervision is not allowed.

### Development

This repository comes with a [`install.sh` script](./scripts/install.sh) that can install the local module version into your instance.
This is helpful to test changes as you develop new features.

To use this script, run it and point to [your Foundry `Data/` folder path](https://foundryvtt.com/article/user-data/), for example:

```sh
./scripts/install.sh /my/foundry/Data
```

### Release process

When a new version of the module is ready to be released, we create a git tag with the new version number.

Version numbers adhere to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

The creation of a new git tag activates a GitHub workflow that:

- Bundles the files necessary for the module in a new folder, this allows the final "shipped" version to be minimized and compressed without extra content like documentation, test, or media assets
- Updates the version numbers in the `module.json` to match the tag
- Prepares the release notes and created a GitHub release