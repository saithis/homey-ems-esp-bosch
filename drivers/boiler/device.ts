import Homey from "homey";
import { EmsEspClient } from "../../lib/ems-esp-client";
import {
  formatLastCode,
  parseLastCode,
  polling,
  setCapabilityValues,
} from "../../lib/utils";
import { BoilerData } from "../../lib/types";

// Settings keys for persisting compressor state across restarts
const COMPRESSOR_ON_TIMESTAMP = "compressorOnTimestamp";
const COMPRESSOR_OFF_TIMESTAMP = "compressorOffTimestamp";
const LAST_RUN_DURATION_MS = "lastRunDurationMs";

export class BoilerDevice extends Homey.Device {
  private stopPolling: (() => void) | null = null;

  // State tracking for trigger change detection
  private lastHpactivity: string | null = null;
  private lastHpcompon: string | null = null;
  private lastHpcompspd: number = 0;
  private lastEmittedWwcurtemp: number | null = null;
  private lastRunDurationMs: number | null = null;
  private compressorStateInitialized = false;
  private deviceWasUnavailable = false;

  // Trigger card references
  private hpactivityChangedTrigger: Homey.FlowCardTriggerDevice | undefined;
  private compressorTurnedOffTrigger: Homey.FlowCardTriggerDevice | undefined;
  private compressorTurnedOnTrigger: Homey.FlowCardTriggerDevice | undefined;
  private wwcurtempChangedTrigger: Homey.FlowCardTriggerDevice | undefined;

  private get client() {
    return new EmsEspClient(
      this.getSetting("network_address"),
      this.getSetting("access_token")
    );
  }

  private get intervalMs() {
    return Number(this.getSetting("poll_interval") || 10000);
  }

  private loadPersistedState() {
    const onTs = this.homey.settings.get(COMPRESSOR_ON_TIMESTAMP);
    const offTs = this.homey.settings.get(COMPRESSOR_OFF_TIMESTAMP);
    const runDuration = this.homey.settings.get(LAST_RUN_DURATION_MS);

    if (onTs != null) {
      this.compressorStateInitialized = true;
    }
    if (runDuration != null) {
      this.lastRunDurationMs = runDuration;
    }
    this.log(
      `Loaded persisted state: onTs=${onTs}, offTs=${offTs}, lastRun=${runDuration}ms, initialized=${this.compressorStateInitialized}`
    );
  }

  private async triggerFlows(newData: BoilerData) {
    const currentHpactivity = newData.hpactivity ?? "unknown";
    const currentHpcompon = newData.hpcompon;
    const currentWwcurtemp = newData.dhw?.curtemp ?? 0;
    const outdoorTemp = newData.outdoortemp;

    // --- hpactivity change detection ---
    if (
      this.lastHpactivity !== null &&
      this.lastHpactivity !== currentHpactivity
    ) {
      await this.hpactivityChangedTrigger
        ?.trigger(
          this,
          {
            old_activity: this.lastHpactivity,
            new_activity: currentHpactivity,
            outdoor_temp: outdoorTemp,
          },
          undefined
        )
        .catch(this.error);
    }
    this.lastHpactivity = currentHpactivity;

    // --- Compressor on/off transition detection ---
    if (currentHpcompon && this.lastHpcompon !== null) {
      const canTrigger =
        this.compressorStateInitialized && !this.deviceWasUnavailable;

      if (this.lastHpcompon === "on" && currentHpcompon === "off") {
        // Compressor turned off — calculate run duration
        const onTimestamp = this.homey.settings.get(COMPRESSOR_ON_TIMESTAMP);
        const runDurationMs = onTimestamp ? Date.now() - onTimestamp : 0;
        this.lastRunDurationMs = runDurationMs;
        this.homey.settings.set(LAST_RUN_DURATION_MS, runDurationMs);
        this.homey.settings.set(COMPRESSOR_OFF_TIMESTAMP, Date.now());

        if (canTrigger) {
          await this.compressorTurnedOffTrigger
            ?.trigger(
              this,
              {
                outdoor_temp: outdoorTemp,
                run_duration_minutes: Math.round((runDurationMs / 60000) * 10) / 10,
              },
              undefined
            )
            .catch(this.error);
        }
      } else if (this.lastHpcompon === "off" && currentHpcompon === "on") {
        // Compressor turned on — calculate off duration
        const offTimestamp = this.homey.settings.get(COMPRESSOR_OFF_TIMESTAMP);
        const offDurationMs = offTimestamp ? Date.now() - offTimestamp : 0;
        this.homey.settings.set(COMPRESSOR_ON_TIMESTAMP, Date.now());

        if (canTrigger) {
          await this.compressorTurnedOnTrigger
            ?.trigger(
              this,
              {
                outdoor_temp: outdoorTemp,
                off_duration_minutes: Math.round((offDurationMs / 60000) * 10) / 10,
              },
              undefined
            )
            .catch(this.error);
        }

        if (!this.compressorStateInitialized) {
          this.compressorStateInitialized = true;
        }
      }
    } else if (currentHpcompon && this.lastHpcompon === null) {
      // First poll — store initial state without triggering
      if (currentHpcompon === "on") {
        this.homey.settings.set(COMPRESSOR_ON_TIMESTAMP, Date.now());
      } else {
        this.homey.settings.set(COMPRESSOR_OFF_TIMESTAMP, Date.now());
      }
    }
    this.lastHpcompon = currentHpcompon ?? null;

    // --- wwcurtemp change detection (delta-based) ---
    if (this.lastEmittedWwcurtemp !== null) {
      const delta = Math.abs(currentWwcurtemp - this.lastEmittedWwcurtemp);
      if (delta > 0) {
        await this.wwcurtempChangedTrigger
          ?.trigger(
            this,
            {
              wwcurtemp: currentWwcurtemp,
              ww_target_temp: newData.dhw?.seltemp ?? 0,
              outdoor_temp: outdoorTemp,
            },
            { delta }
          )
          .catch(this.error);
        this.lastEmittedWwcurtemp = currentWwcurtemp;
      }
    } else {
      this.lastEmittedWwcurtemp = currentWwcurtemp;
    }

    // Store compressor speed for condition cards
    this.lastHpcompspd = newData.hpcompspd ?? 0;

    // Reset unavailable flag on successful poll
    if (this.deviceWasUnavailable) {
      this.deviceWasUnavailable = false;
      this.log("Device recovered from unavailable state, suppressed stale triggers");
    }
  }

  private async updateCapabilityValues(data: BoilerData) {
    return setCapabilityValues(this, [
      ["boiler_curflowtemp", data.curflowtemp],
      ["boiler_rettemp", data.rettemp],
      ["boiler_hpbrinein", data.hpbrinein],
      ["boiler_hpbrineout", data.hpbrineout],
      ["boiler_hpbrinepumpspd", data.hpbrinepumpspd],
      ["boiler_hpcircspd", data.hpcircspd],
      ["boiler_hpcompspd", data.hpcompspd],
      ["boiler_wwcurtemp", data.dhw?.curtemp ?? 0],
      ["boiler_ww_target_temp", data.dhw?.seltemp ?? 0],
      ["boiler_hpactivity", data.hpactivity ?? "unknown"],
      [
        "boiler_last_compressor_run_duration",
        this.lastRunDurationMs != null
          ? Math.round((this.lastRunDurationMs / 60000) * 10) / 10
          : 0,
      ],
      ["boiler_lastcode", formatLastCode(parseLastCode(data.lastcode))],
    ]);
  }

  private startPolling() {
    this.stopPolling?.();

    this.stopPolling = polling(
      this.intervalMs,
      () => this.client.getBoilerData(),
      async (err, res) => {
        if (err) {
          this.error(err);
          this.deviceWasUnavailable = true;
          await this.setUnavailable(`${err}`).catch(this.error);
          // Automatically restart polling after the interval to recover from errors.
          setTimeout(() => this.startPolling(), this.intervalMs * 2);
        } else if (res) {
          await this.updateCapabilityValues(res).catch(this.error);
          await this.setAvailable().catch(this.error);
          await this.triggerFlows(res).catch(this.error);
        }
      }
    );
  }

  async onInit() {
    this.loadPersistedState();

    this.hpactivityChangedTrigger = this.homey.flow.getDeviceTriggerCard(
      "boiler_hpactivity_changed"
    );
    this.compressorTurnedOffTrigger = this.homey.flow.getDeviceTriggerCard(
      "boiler_compressor_turned_off"
    );
    this.compressorTurnedOnTrigger = this.homey.flow.getDeviceTriggerCard(
      "boiler_compressor_turned_on"
    );
    this.wwcurtempChangedTrigger = this.homey.flow.getDeviceTriggerCard(
      "boiler_wwcurtemp_changed"
    );

    // Register condition card listeners
    this.homey.flow
      .getConditionCard("hpactivity-is")
      .registerRunListener(async (args: { activity: string }) => {
        return this.lastHpactivity === args.activity;
      });

    this.homey.flow
      .getConditionCard("compressor-speed-greater-than")
      .registerRunListener(async (args: { speed: number }) => {
        return this.lastHpcompspd > args.speed;
      });

    this.homey.flow
      .getConditionCard("compressor-speed-less-than")
      .registerRunListener(async (args: { speed: number }) => {
        return this.lastHpcompspd < args.speed;
      });

    this.homey.flow
      .getConditionCard("last-run-shorter-than")
      .registerRunListener(async (args: { minutes: number }) => {
        if (this.lastRunDurationMs == null) return false;
        return this.lastRunDurationMs / 60000 < args.minutes;
      });

    this.homey.flow
      .getConditionCard("last-run-longer-than")
      .registerRunListener(async (args: { minutes: number }) => {
        if (this.lastRunDurationMs == null) return false;
        return this.lastRunDurationMs / 60000 > args.minutes;
      });

    this.startPolling();
  }

  onDeleted() {
    this.stopPolling?.();
  }
}

module.exports = BoilerDevice;
