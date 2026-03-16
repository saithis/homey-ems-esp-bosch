# Brainstorm: Heat Pump Anti-Cycling & Post-DHW Control

**Date:** 2026-03-16
**Status:** Reviewed

## What We're Building

New flow cards and multi-circuit support for the Homey EMS-ESP Bosch app that give users the tools to prevent two problematic heat pump behaviors:

1. **Short-cycling in transitional weather**: When outdoor temp is below summer mode threshold but warm enough (especially on sunny days) that heating demand drops below the heat pump's minimum modulation, causing rapid on/off cycling that damages the compressor.

2. **Post-DHW pause optimization**: After heating domestic hot water, the heat pump's internal temperature is too high for the required heating temperature, causing a brief shutdown. Depending on conditions (outdoor temp, solar gain), the heat pump should either skip the shutdown or extend it.

Additionally, the app needs to support **multiple heating circuits** and provide **direct control actions** (set temp per circuit, toggle summer mode).

## Why This Approach

**Flow cards over built-in logic** — Full control over automation logic in Homey flows, not opaque app-side behavior. The app's job is to expose the right data and actions.

**Predictive, not reactive** — Evaluate conditions on the *first* transition to "Off" and decide whether to intervene. Key inputs: outdoor temperature, solar panel power output (from a separate Homey device).

**No auto-revert in action cards** — Homey's built-in delay nodes handle timing. Action cards just set values; the user chains delay → revert in the flow. This keeps the app simple.

**Auto-detect heating circuits** — Query the thermostat API and expose all available heating circuits (hc1, hc2, etc.) automatically.

## Key Decisions

1. **Flow cards, not built-in app logic** — All control decisions happen in user-configured Homey flows.

2. **Predict short-cycling on first "Off" transition** — Use outdoor temp + solar panel power (from external Homey capability) as inputs. No need to wait for repeated cycles.

3. **Adjust target temperature as the intervention** — Raise target temp to keep running, or lower it to keep off. Use Homey delay nodes for timing.

4. **No auto-revert** — Action cards just set temperatures. Users use Homey's delay node + a second action to revert. Keeps action cards simple.

5. **Multi-circuit support** — Auto-detect heating circuits from the EMS-ESP thermostat API. Flow cards reference circuits.

6. **Summer mode toggle** — Direct toggle of `summermode` per heating circuit via EMS-ESP write command (not manipulating the threshold).

7. **Persist compressor state across restarts** — Store compressor on/off timestamps in Homey settings.

8. **Expose both hpactivity and wwcurtemp** — Two ways to detect DHW cycles regardless of what the specific Bosch model reports.

9. **Note: heatondelay/heatoffdelay are for summer mode auto-transitions**, not compressor cycling delays.

10. **Preemptive DHW handling** — Act *before* the heat pump shuts down after DHW, not after. Use `hpactivity_changed` (new_activity="hot water") for early detection, and `wwcurtemp_changed` with its target temp token to calculate proximity to DHW completion in the flow.

## New Flow Cards

### Triggers

| Card | Tokens | Description |
|------|--------|-------------|
| `hpactivity_changed` | `old_activity`, `new_activity`, `outdoor_temp` | Fires when hpactivity changes (none/heating/hot water/defrost/cooling/pool). Use with new_activity="hot water" to detect DHW start. |
| `compressor_turned_off` | `outdoor_temp`, `run_duration_minutes` | Fires when compressor transitions on→off. Includes how long it ran. |
| `wwcurtemp_changed` | `wwcurtemp`, `ww_target_temp`, `outdoor_temp` | Fires when tap water temperature changes by at least a configurable delta (e.g. 0.5°C). Includes target temp so user can calculate proximity to target in the flow. Args: `min_delta_degrees`. |

### Conditions

| Card | Args | Description |
|------|------|-------------|
| `hpactivity_is` | `activity` (dropdown) | Check if current hpactivity matches a specific value |
| `compressor_speed_comparison` | `operator`, `speed` | Check if compressor speed is >/</= a threshold |
| `last_run_shorter_than` | `minutes` | Check if the last compressor run was shorter than X minutes |

### Actions

| Card | Args | Description |
|------|------|-------------|
| `set_hc_target_temp` | `circuit`, `temperature` | Set target temperature for a specific heating circuit |
| `adjust_hc_target_temp_offset` | `circuit`, `offset_degrees` | Add/subtract from current target temp of a heating circuit |
| `set_hc_summer_mode` | `circuit`, `enabled` (on/off) | Toggle summer mode for a specific heating circuit |

### New Capabilities (visible on device)

| Capability | Type | Description |
|------------|------|-------------|
| `hpactivity` | string | Current heat pump activity (none/heating/hot water/etc.) |
| `last_compressor_run_duration` | number | Duration of last compressor run in minutes |
| `wwcurtemp` | number | Current tap water (DHW) temperature |
| `ww_target_temp` | number | DHW target temperature (needed as token in wwcurtemp_changed) |

## Example Flows

### Anti-short-cycling flow
```
WHEN compressor turns off
  AND outdoor temp > 8°C
  AND solar power > 2000W (external device condition)
  AND last run < 10 minutes
THEN adjust HC1 target temp by -1°C
  → Delay 30 minutes
  → Adjust HC1 target temp by +1°C  (inverse offset to revert)
```

### Pre-DHW: cold/cloudy — prevent shutdown after DHW
```
WHEN wwcurtemp changed (delta >= 0.5°C)
  AND hpactivity is "hot water"
  AND wwcurtemp > (ww_target_temp - 2)  (calculated in flow logic)
  AND outdoor temp < 5°C
THEN adjust HC1 target temp by +2°C
  → Delay 15 minutes
  → Adjust HC1 target temp by -2°C
```

### Pre-DHW: warm/sunny — extend off after DHW
```
WHEN wwcurtemp changed (delta >= 0.5°C)
  AND hpactivity is "hot water"
  AND wwcurtemp > (ww_target_temp - 2)
  AND outdoor temp > 10°C
  AND solar power > 3000W (external device condition)
THEN set HC1 summer mode ON
  → Delay 20 minutes
  → Set HC1 summer mode OFF
```

### Early DHW preparation
```
WHEN hpactivity changed (new = "hot water")
  AND outdoor temp > 8°C
  AND solar power > 2000W
THEN set HC1 summer mode ON
  → Delay (until DHW expected to finish)
  → Set HC1 summer mode OFF
```

### Prevent short-cycling via summer mode
```
WHEN compressor turns off
  AND outdoor temp > 12°C
  AND solar power > 4000W
THEN set HC1 summer mode ON
  → Delay 60 minutes
  → Set HC1 summer mode OFF
```

## Resolved Questions

- **No auto-revert needed** — Homey's built-in delay nodes handle timing. Action cards are simple set operations.
- **DHW detection** — Expose both `hpactivity` (with trigger) and `wwcurtemp` as capabilities.
- **heatondelay/heatoffdelay** — These are for summer mode auto-transitions, not compressor cycling. Not relevant for the anti-cycling logic.
- **Multiple heating circuits** — Auto-detect from EMS-ESP API. Action cards include a circuit selector.
- **Summer mode control** — Direct toggle of `summermode` per circuit, not threshold manipulation.

## Technical Notes

- **Driver ownership**: Triggers/conditions for hpactivity, compressor, and wwcurtemp belong to the **boiler driver**. Actions for target temp and summer mode belong to the **thermostat driver** (per heating circuit).
- `hpactivity` comes from the boiler API (`/api/boiler`), not the thermostat API
- `hpcompspd` (compressor speed) and `hpcompon` (compressor on/off) are already polled by the boiler driver
- Target temp writes go through `setSelectedTemp` on the thermostat API
- Summer mode writes go through the thermostat API per heating circuit
- Compressor timestamps should be stored via `this.homey.settings.set()` / `this.homey.settings.get()`
- The existing `thermostat_hc1_hpoperatingstate_changed` trigger can complement the new cards
- Multi-circuit: thermostat API returns `hc1`, `hc2`, etc. — iterate over available circuits during device init
- **Polling resolution**: Boiler polls every 10s, thermostat every 5s. Compressor run duration is approximate (±10s). Short events between polls may be missed.
- **Revert patterns in flows**: Users can revert temp changes using either inverse offsets (adjust by -X after +X) or Homey Advanced Flow variables to store/restore the original value.
