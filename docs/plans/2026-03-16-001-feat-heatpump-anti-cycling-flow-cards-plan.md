---
title: "feat: Heat Pump Anti-Cycling & Post-DHW Flow Cards"
type: feat
status: completed
date: 2026-03-16
origin: docs/brainstorms/2026-03-16-heatpump-anti-cycling-brainstorm.md
---

# feat: Heat Pump Anti-Cycling & Post-DHW Flow Cards

## Overview

Add new flow cards (triggers, conditions, actions), capabilities, and multi-circuit support to the Homey EMS-ESP Bosch app. These building blocks let users build Homey flows that prevent compressor short-cycling in transitional weather and optimize post-DHW behavior — without embedding control logic in the app itself.

Also fix a pre-existing bug where the thermostat operating state trigger fires repeatedly after each state change.

## Problem Statement

1. **Short-cycling**: In transitional weather (outdoor temp below summer threshold but warm enough with solar gain), heating demand drops below minimum modulation. The heat pump cycles on/off rapidly, damaging the compressor.

2. **Post-DHW pause**: After heating domestic hot water, the heat pump's internal temperature is too high for space heating, causing a brief useless shutdown. Depending on conditions, it should either not shut down or stay off longer.

3. **No write actions**: The app has no action flow cards — users can't adjust target temperature or toggle modes via flows.

4. **Single circuit**: The app is hardcoded to hc1. Users with multiple heating circuits can't monitor or control hc2+.

## Proposed Solution

Expose new triggers, conditions, and actions as Homey flow cards following the existing codebase patterns. The app provides data and write actions; all control logic lives in user-configured Homey flows. (see brainstorm: docs/brainstorms/2026-03-16-heatpump-anti-cycling-brainstorm.md)

Key design decisions from brainstorm:
- **Flow cards, not built-in logic** — users wire up automation in Homey flows
- **Predictive, not reactive** — act on first "Off" transition based on conditions, not after repeated cycles
- **No auto-revert** — action cards just set values; Homey delay nodes handle timing
- **Auto-detect heating circuits** from EMS-ESP thermostat API
- **Persist compressor state** across app restarts via Homey settings

## Technical Approach

### Architecture

**Driver ownership split:**
- **Boiler driver** owns: `hpactivity_changed`, `compressor_turned_off`, `compressor_turned_on`, `wwcurtemp_changed` triggers + `hpactivity_is`, `compressor_speed_greater_than`, `compressor_speed_less_than`, `last_run_shorter_than`, `last_run_longer_than` conditions
- **Thermostat driver** owns: `set_hc_target_temp`, `adjust_hc_target_temp_offset`, `set_hc_summer_mode` actions

**State tracking in boiler device:**
- Track `hpcompon` transitions (authoritative field for compressor on/off — discrete boolean, not speed-based)
- Store `compressorOnTimestamp` and `lastRunDurationMs` in Homey settings for persistence
- Store `lastEmittedWwcurtemp` for delta comparison on `wwcurtemp_changed`
- Track `lastHpactivity` for change detection
- Track `deviceWasUnavailable` flag to suppress stale triggers after connectivity gaps

**Multi-circuit in thermostat device:**
- On init, poll thermostat API and detect which `hcN` fields are present
- Store detected circuits for autocomplete in action card args
- Re-detect on each poll (circuits don't change dynamically, but handles firmware updates)

**EMS-ESP client additions:**
- `setHcSelectedTemp(hcId: number, temp: number)` — POST `api/thermostat` with `{ cmd: "seltemp", id: hcId, data: temp }`
- `setHcSummerMode(hcId: number, enabled: boolean)` — POST `api/thermostat` with `{ cmd: "summermode", id: hcId, data: enabled ? "on" : "off" }`
- Note: summer mode command needs verification against actual EMS-ESP firmware

### Implementation Phases

#### Phase 0: Bug Fix — Thermostat Trigger Repeated Firing

**Problem:** In `drivers/thermostat/device.ts:54`, `return` before `this.oldData = newData` (line 63) causes `oldData` to never update after a state change. The trigger fires on every subsequent poll until the state changes again.

**Fix:** Move `this.oldData = newData` before the conditional trigger block.

**File:** `drivers/thermostat/device.ts`

```typescript
// Before (buggy):
private async triggerFlows(newData: ThermostatData) {
  const newHc1 = newData.hc1;
  const oldHc1 = this.oldData?.hc1;
  if (oldHc1 && newHc1 && oldHc1.hpoperatingstate !== newHc1.hpoperatingstate) {
    return this.hpoperatingstateChangedTrigger?.trigger(this, { ... }, undefined);
  }
  this.oldData = newData;
}

// After (fixed):
private async triggerFlows(newData: ThermostatData) {
  const newHc1 = newData.hc1;
  const oldHc1 = this.oldData?.hc1;
  this.oldData = newData;  // Always update before checking
  if (oldHc1 && newHc1 && oldHc1.hpoperatingstate !== newHc1.hpoperatingstate) {
    await this.hpoperatingstateChangedTrigger?.trigger(this, { ... }, undefined);
  }
}
```

**Tasks:**
- [x] Fix `this.oldData` assignment order in `drivers/thermostat/device.ts:triggerFlows`
- [x] Remove the `return` — use `await` instead so execution continues

---

#### Phase 1: New Boiler Capabilities & Triggers

Add capabilities and state tracking to the boiler driver.

**New capabilities:**

| File | Capability ID | Type | Details |
|------|---------------|------|---------|
| `.homeycompose/capabilities/boiler_hpactivity.json` | `boiler_hpactivity` | string | Current HP activity. getable, not setable. insights: true |
| `.homeycompose/capabilities/boiler_last_compressor_run_duration.json` | `boiler_last_compressor_run_duration` | number | Minutes. min: 0, step: 0.1. insights: true |
| `.homeycompose/capabilities/boiler_ww_target_temp.json` | `boiler_ww_target_temp` | number | °C. Uses `dhw.seltemp` (active target reflecting eco/comfort mode) |

Note: `boiler_wwcurtemp` already exists — no duplication needed.

**Tasks:**
- [x] Create `.homeycompose/capabilities/boiler_hpactivity.json`
- [x] Create `.homeycompose/capabilities/boiler_last_compressor_run_duration.json`
- [x] Create `.homeycompose/capabilities/boiler_ww_target_temp.json`
- [x] Add new capabilities to `drivers/boiler/driver.compose.json`
- [x] Add compressor state tracking to `drivers/boiler/device.ts`:
  - Track `hpcompon` transitions using stored `lastHpcompon` state
  - On `hpcompon` "on" → store timestamp via `this.homey.settings.set("compressorOnTimestamp", Date.now())`
  - On `hpcompon` "off" → calculate duration, store via `this.homey.settings.set("lastRunDurationMs", duration)`
  - On init: load persisted values from settings. If no prior state exists, set `compressorStateInitialized = false`
  - Track `deviceWasUnavailable` — set true on error, check on recovery to suppress stale triggers
- [x] Map new capabilities in `updateCapabilityValues()`:
  - `boiler_hpactivity` ← `data.hpactivity ?? "unknown"`
  - `boiler_last_compressor_run_duration` ← `lastRunDurationMs / 60000` (minutes)
  - `boiler_ww_target_temp` ← `data.dhw?.seltemp ?? 0`
  - `boiler_wwcurtemp` ← already mapped

**New triggers in `drivers/boiler/driver.flow.compose.json`:**

```json
{
  "triggers": [
    {
      "id": "boiler_hpactivity_changed",
      "title": { "en": "Heat pump activity changed" },
      "tokens": [
        { "type": "string", "name": "old_activity", "title": { "en": "Previous activity" }, "example": { "en": "heating" } },
        { "type": "string", "name": "new_activity", "title": { "en": "New activity" }, "example": { "en": "hot water" } },
        { "type": "number", "name": "outdoor_temp", "title": { "en": "Outdoor temperature" }, "example": { "en": "12" } }
      ]
    },
    {
      "id": "boiler_compressor_turned_off",
      "title": { "en": "Compressor turned off" },
      "tokens": [
        { "type": "number", "name": "outdoor_temp", "title": { "en": "Outdoor temperature" }, "example": { "en": "12" } },
        { "type": "number", "name": "run_duration_minutes", "title": { "en": "Run duration (minutes)" }, "example": { "en": "8.5" } }
      ]
    },
    {
      "id": "boiler_compressor_turned_on",
      "title": { "en": "Compressor turned on" },
      "tokens": [
        { "type": "number", "name": "outdoor_temp", "title": { "en": "Outdoor temperature" }, "example": { "en": "12" } },
        { "type": "number", "name": "off_duration_minutes", "title": { "en": "Off duration (minutes)" }, "example": { "en": "3.2" } }
      ]
    },
    {
      "id": "boiler_wwcurtemp_changed",
      "title": { "en": "Tap water temperature changed" },
      "titleFormatted": { "en": "Tap water temperature changed by at least [[min_delta]] °C" },
      "args": [
        { "type": "range", "name": "min_delta", "min": 0.1, "max": 5, "step": 0.1, "label": { "en": "°C" }, "labelDecimals": 1 }
      ],
      "tokens": [
        { "type": "number", "name": "wwcurtemp", "title": { "en": "Tap water temperature" }, "example": { "en": "48.5" } },
        { "type": "number", "name": "ww_target_temp", "title": { "en": "Tap water target temperature" }, "example": { "en": "55" } },
        { "type": "number", "name": "outdoor_temp", "title": { "en": "Outdoor temperature" }, "example": { "en": "12" } }
      ]
    }
  ]
}
```

**Tasks:**
- [x] Add triggers to `drivers/boiler/driver.flow.compose.json`
- [x] Register trigger run listeners in `drivers/boiler/driver.ts` (all return true — filtering is via tokens/conditions)
  - `boiler_wwcurtemp_changed` run listener: compare `state.delta` against `args.min_delta`
- [x] Add `triggerFlows()` method to `drivers/boiler/device.ts`:
  - Compare `lastHpactivity` vs current `hpactivity` → fire `boiler_hpactivity_changed`
  - Compare `lastHpcompon` vs current `hpcompon`:
    - "on" → "off": fire `boiler_compressor_turned_off` with run duration. Suppress if `!compressorStateInitialized || deviceWasUnavailable`
    - "off" → "on": fire `boiler_compressor_turned_on` with off duration. Same suppression logic.
  - Compare `lastEmittedWwcurtemp` vs current `dhw.curtemp`: fire `boiler_wwcurtemp_changed` with state `{ delta: Math.abs(current - lastEmitted) }` (run listener filters by `min_delta` arg)
  - `outdoor_temp` token: use `data.outdoortemp` from boiler API (instantaneous reading, not the damped/averaged `dampedoutdoortemp` from the thermostat API)

**Compressor state initialization:**
- On first install / cleared settings: `compressorStateInitialized = false`
- First poll seeing `hpcompon`: store state but don't fire triggers
- After seeing at least one transition: `compressorStateInitialized = true`
- `last_run_shorter_than` / `last_run_longer_than` conditions return `false` when no history exists

**Connectivity gap handling:**
- When device goes unavailable (error in polling callback): set `deviceWasUnavailable = true`
- When device recovers: update stored state silently (no triggers), reset `deviceWasUnavailable = false`

---

#### Phase 2: New Boiler Conditions

**New condition cards in `.homeycompose/flow/conditions/`:**

| File | ID | Args | Description |
|------|-----|------|-------------|
| `hpactivity-is.json` | `hpactivity-is` | `activity` (dropdown: none, heating, cooling, hot water, pool, defrost) | Check current hpactivity |
| `compressor-speed-greater-than.json` | `compressor-speed-greater-than` | `speed` (range: 0-100) | Compressor speed > threshold |
| `compressor-speed-less-than.json` | `compressor-speed-less-than` | `speed` (range: 0-100) | Compressor speed < threshold |
| `last-run-shorter-than.json` | `last-run-shorter-than` | `minutes` (range: 1-120) | Last compressor run < X min |
| `last-run-longer-than.json` | `last-run-longer-than` | `minutes` (range: 1-120) | Last compressor run > X min |

Note: Two separate cards for speed comparison (not an operator dropdown) — follows the existing `outdoor-temp-greater-than` / `outdoor-temp-less-than` pattern for UI consistency.

**Tasks:**
- [x] Create 5 condition card JSON files in `.homeycompose/flow/conditions/`
- [x] Register condition run listeners in `drivers/boiler/device.ts`:
  - `hpactivity-is`: compare `this.lastHpactivity` against `args.activity`
  - `compressor-speed-greater-than`: compare `this.lastHpcompspd` against `args.speed`
  - `compressor-speed-less-than`: same, inverted
  - `last-run-shorter-than`: compare `this.lastRunDurationMs / 60000` against `args.minutes`. Return `false` if no history.
  - `last-run-longer-than`: same, inverted

---

#### Phase 3: Multi-Circuit Support & Thermostat Actions

**EMS-ESP client additions in `lib/ems-esp-client.ts`:**

```typescript
public async setHcSelectedTemp(hcId: number, temp: number) {
  await this.post("api/thermostat", { cmd: "seltemp", id: hcId, data: temp });
}

public async setHcSummerMode(hcId: number, enabled: boolean) {
  await this.post("api/thermostat", { cmd: "summermode", id: hcId, data: enabled ? "on" : "off" });
}
```

**Multi-circuit detection in thermostat device:**

```typescript
private detectedCircuits: number[] = [];

private detectCircuits(data: ThermostatData) {
  const circuits: number[] = [];
  for (let i = 1; i <= 4; i++) {
    const key = `hc${i}` as keyof ThermostatData;
    if (data[key]) circuits.push(i);
  }
  this.detectedCircuits = circuits;
}
```

**New action cards in `drivers/thermostat/driver.flow.compose.json`:**

```json
{
  "actions": [
    {
      "id": "thermostat_set_hc_target_temp",
      "title": { "en": "Set heating circuit target temperature" },
      "titleFormatted": { "en": "Set HC[[circuit]] target temperature to [[temperature]]°C" },
      "args": [
        { "type": "autocomplete", "name": "circuit", "placeholder": { "en": "Select circuit" } },
        { "type": "range", "name": "temperature", "min": 5, "max": 30, "step": 0.5, "label": { "en": "°C" }, "labelDecimals": 1 }
      ]
    },
    {
      "id": "thermostat_adjust_hc_target_temp_offset",
      "title": { "en": "Adjust heating circuit target temperature" },
      "titleFormatted": { "en": "Adjust HC[[circuit]] target temperature by [[offset]]°C" },
      "args": [
        { "type": "autocomplete", "name": "circuit", "placeholder": { "en": "Select circuit" } },
        { "type": "range", "name": "offset", "min": -5, "max": 5, "step": 0.5, "label": { "en": "°C" }, "labelDecimals": 1 }
      ]
    },
    {
      "id": "thermostat_set_hc_summer_mode",
      "title": { "en": "Set heating circuit summer mode" },
      "titleFormatted": { "en": "Set HC[[circuit]] summer mode to [[enabled]]" },
      "args": [
        { "type": "autocomplete", "name": "circuit", "placeholder": { "en": "Select circuit" } },
        { "type": "dropdown", "name": "enabled", "values": [
          { "id": "on", "label": { "en": "On" } },
          { "id": "off", "label": { "en": "Off" } }
        ] }
      ]
    }
  ]
}
```

**Tasks:**
- [x] Add `setHcSelectedTemp`, `setHcSummerMode` to `lib/ems-esp-client.ts`
- [x] Add circuit detection to thermostat `device.ts` — call `detectCircuits()` on each poll
- [x] Add action cards to `drivers/thermostat/driver.flow.compose.json`
- [x] Register autocomplete handler for `circuit` arg in `drivers/thermostat/driver.ts`:
  ```typescript
  this.homey.flow.getActionCard("thermostat_set_hc_target_temp")
    .registerArgumentAutocompleteListener("circuit", async (query, args) => {
      const device = args.device as ThermostatDevice;
      return device.detectedCircuits.map(id => ({
        name: `HC${id}`,
        id: String(id),
      })).filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
    });
  ```
- [x] Register action run listeners in thermostat `driver.ts` or `device.ts`:
  - `thermostat_set_hc_target_temp`: stop polling, call `client.setHcSelectedTemp(hcId, temp)`, restart polling after interval
  - `thermostat_adjust_hc_target_temp_offset`: read current `seltemp` from last poll data for the selected circuit, add offset, clamp to valid range (5-30°C), write. Stop/restart polling.
  - `thermostat_set_hc_summer_mode`: call `client.setHcSummerMode(hcId, enabled === "on")`
- [x] Update existing `setSelectedTemp` to use circuit-aware `setHcSelectedTemp(1, temp)` for backward compatibility

**Temperature bounds:**
- `set_hc_target_temp`: range arg enforces 5-30°C
- `adjust_hc_target_temp_offset`: clamp result to 5-30°C before writing. If clamped, log a warning.

**Write error handling:**
- Action run listeners throw on failure (Homey flow reports the error to the user)
- Do not catch and swallow — let the flow framework handle it

---

**Out of scope:** Exposing hc2+ as separate device capabilities. The action cards already support any circuit via autocomplete. Existing hc1 capabilities remain unchanged. Per-circuit capabilities can be a separate feature if needed later.

## System-Wide Impact

### Interaction Graph

- Boiler polling callback → `updateCapabilityValues()` → capability updates → `triggerFlows()` → trigger cards fire → user flows evaluate conditions → user flows call action cards → EMS-ESP write → thermostat polling paused → thermostat polling resumed
- Compressor state tracker reads `hpcompon` from boiler poll → persists timestamps to Homey settings → calculates duration → exposes via capability + trigger token

### Error Propagation

- EMS-ESP read failure (boiler/thermostat): device goes unavailable, polling doubles interval, auto-retries
- EMS-ESP write failure (action cards): exception propagates to Homey flow framework, flow reports error to user
- Missing `dhw` data in boiler response: capabilities set to 0/default, `wwcurtemp_changed` does not fire (no valid delta)
- Missing `hcN` in thermostat response: circuit not listed in autocomplete, action card for that circuit fails with descriptive error

### State Lifecycle Risks

- **Compressor timestamps and unavailability**: If device was unavailable between "on" and "off" readings, the run duration is inaccurate. Mitigated by `deviceWasUnavailable` flag suppressing triggers.
- **Offset stacking**: Two flows adjusting the same circuit via offset can conflict. Documented in brainstorm — user responsibility. Example flows show the pattern.
- **Polling pause during writes**: If multiple action cards fire simultaneously for the same thermostat device, only the first stops polling; subsequent writes happen without polling protection. Mitigated by Homey's sequential flow execution within a single flow.

### API Surface Parity

- Existing `target_temperature` capability listener on thermostat → should be updated to use `setHcSelectedTemp(1, value)` for consistency
- Existing `thermostat_hc1_hpoperatingstate_changed` trigger → remains, complements new `boiler_hpactivity_changed`

## Acceptance Criteria

### Functional Requirements

- [ ] `boiler_hpactivity_changed` trigger fires once per activity transition with correct old/new tokens
- [ ] `boiler_compressor_turned_off` trigger fires on `hpcompon` on→off with accurate run duration
- [ ] `boiler_compressor_turned_on` trigger fires on `hpcompon` off→on with off duration
- [ ] `boiler_wwcurtemp_changed` trigger fires when delta exceeds configured `min_delta` threshold
- [ ] All 5 condition cards return correct boolean results
- [ ] `last_run_shorter_than` / `last_run_longer_than` return false when no compressor history exists
- [ ] `thermostat_set_hc_target_temp` writes correct temperature to selected circuit via EMS-ESP
- [ ] `thermostat_adjust_hc_target_temp_offset` reads current temp, applies offset, clamps to 5-30°C, writes
- [ ] `thermostat_set_hc_summer_mode` toggles summer mode for selected circuit
- [ ] Action card circuit autocomplete lists all detected heating circuits
- [ ] Compressor on/off timestamps persist across app restarts
- [ ] Triggers are suppressed after connectivity gaps (device was unavailable)
- [ ] Existing `thermostat_hc1_hpoperatingstate_changed` trigger no longer fires repeatedly (bug fix)

### Non-Functional Requirements

- [ ] No new polling endpoints — all data comes from existing boiler/thermostat polls
- [ ] Write actions pause and restart thermostat polling (following existing `target_temperature` pattern)
- [ ] All new capabilities have `insights: true` for historical charting

### Quality Gates

- [ ] All existing tests pass
- [ ] New flow cards appear correctly in Homey flow editor
- [ ] Manual test: create an anti-short-cycling flow and verify it fires correctly
- [ ] Manual test: verify summer mode write command works on actual EMS-ESP hardware

## Dependencies & Prerequisites

- **EMS-ESP firmware**: Must support `summermode` write command per heating circuit. Verify against actual hardware before Phase 3.
- **Homey SDK v3**: All patterns are compatible with current SDK version used in the project.
- **Access token**: Write commands require the access token to be configured (already handled by pairing flow).

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| `summermode` command not supported by EMS-ESP firmware | Phase 3 action card doesn't work | Test early. If unsupported, fall back to manipulating `summertemp` threshold. |
| Compressor state detection inaccurate due to 10s polling | Short runs (<10s) missed entirely | Documented limitation. For most heat pumps, runs are minutes not seconds. |
| Multiple offset adjustments stacking incorrectly | User's target temp drifts from intended value | Documented in brainstorm. Users can use Homey variables or the absolute `set_hc_target_temp` action. |
| Multi-circuit detection finds no circuits on some firmware versions | Action cards have empty autocomplete | Default to hc1 if no circuits detected. Log warning. |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-16-heatpump-anti-cycling-brainstorm.md](docs/brainstorms/2026-03-16-heatpump-anti-cycling-brainstorm.md) — Key decisions: flow cards over built-in logic, no auto-revert, predictive intervention, multi-circuit auto-detect, persist compressor state.

### Internal References

- Existing trigger pattern: [drivers/boiler/driver.ts:6-15](drivers/boiler/driver.ts#L6-L15)
- Existing capability pattern: [drivers/boiler/device.ts:34-46](drivers/boiler/device.ts#L34-L46)
- EMS-ESP write pattern: [lib/ems-esp-client.ts:72-74](lib/ems-esp-client.ts#L72-L74)
- Polling pattern: [lib/utils.ts:85-108](lib/utils.ts#L85-L108)
- Target temp write with polling pause: [drivers/thermostat/device.ts:93-111](drivers/thermostat/device.ts#L93-L111)
- Bug location: [drivers/thermostat/device.ts:46-64](drivers/thermostat/device.ts#L46-L64)
- Types: [lib/types.ts](lib/types.ts) — `BoilerData.hpactivity` (L241), `hpcompon` (L240), `dhw` (L308), `HeatingCircuit` (L79)

### Related Work

- Existing flow conditions: `.homeycompose/flow/conditions/outdoor-temp-*.json`
- Existing trigger throttling: [lib/utils.ts:113-133](lib/utils.ts#L113-L133)
