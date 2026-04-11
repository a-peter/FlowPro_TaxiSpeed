# TaxiSpeed — Flow Pro Widget

A widget for [Flow Pro](https://parallel42.com) by Parallel 42 that displays ground speed while taxiing in Microsoft Flight Simulator.

## Features

- Displays current ground speed in knots
- Colour-coded text: normal / warning / danger
- Auto-shows when on ground, auto-hides when airborne
- Hysteresis-based visibility control to avoid flickering near the hide threshold
- Widget position is saved and restored between sessions
- All speed thresholds are configurable via the Flow Pro settings panel

## Colour scheme

| Speed | Colour |
|-------|--------|
| Below warning threshold | Dark (readable on orange) |
| Warning threshold and above | Yellow |
| Danger threshold and above | Red |

## Default thresholds

| Setting | Default |
|---------|---------|
| Warning speed | 20 kts |
| Danger speed | 30 kts |
| Hide above | 40 kts |
| Show again below | 38 kts |

All thresholds can be adjusted in the Flow Pro settings panel without editing code.

## Installation

1. Download the latest `.zip` from the [Releases](../../releases) page.
2. Quit Microsoft Flight Simulator.
3. Extract the zip into your MSFS **Community** folder.
4. Start the sim, open Flow Pro — the widget appears in the Community section of the editor.

> **MSFS 2024:** The folder name must additionally be registered in Flow Pro. Refer to the official Flow Pro documentation for details.

### Community folder locations

| Version | Path |
|---------|------|
| Microsoft Store | `%LocalAppData%\Packages\Microsoft.FlightSimulator_*\LocalCache\Packages\Community` |
| Steam | `%AppData%\Microsoft Flight Simulator\Packages\Community` |

## Usage

- The overlay appears automatically when the aircraft is on the ground.
- Click the Flow Pro tile to manually toggle the overlay.
- Drag the overlay to reposition it — the position is saved automatically.

## Building from source

Requires Node.js.

```bash
node .github/scripts/build.js "1.0.0"
```

The built package is written to `dist/p42-util-flow-ape42_3060-taxispeed/`.

A GitHub Actions workflow automatically builds and publishes a release when a version tag is pushed to `main`:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## License

[MIT](LICENSE)
