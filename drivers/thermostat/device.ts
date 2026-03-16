import Homey from "homey";
import { EmsEspClient } from "../../lib/ems-esp-client";
import { capitalize, polling, setCapabilityValues } from "../../lib/utils";
import { ThermostatData, HeatingCircuit } from "../../lib/types";

class ThermostatDevice extends Homey.Device {
  private stopPolling: (() => void) | null = null;
  private oldData: ThermostatData | null = null;
  private hpoperatingstateChangedTrigger:
    | Homey.FlowCardTriggerDevice
    | undefined;

  // Multi-circuit support
  public detectedCircuits: number[] = [];

  private get intervalMs() {
    return Number(this.getSetting("poll_interval") || 10000);
  }

  public get client() {
    return new EmsEspClient(
      this.getSetting("network_address"),
      this.getSetting("access_token")
    );
  }

  private detectCircuits(data: ThermostatData) {
    const circuits: number[] = [];
    for (let i = 1; i <= 4; i++) {
      const key = `hc${i}` as keyof ThermostatData;
      if (data[key]) circuits.push(i);
    }
    if (circuits.length === 0) {
      // Default to hc1 if no circuits detected
      this.log("No heating circuits detected, defaulting to hc1");
      circuits.push(1);
    }
    this.detectedCircuits = circuits;
  }

  public getHcData(hcId: number): HeatingCircuit | undefined {
    const key = `hc${hcId}` as keyof ThermostatData;
    return this.oldData?.[key] as HeatingCircuit | undefined;
  }

  private startPolling() {
    this.stopPolling?.();

    this.stopPolling = polling(
      this.intervalMs,
      () => this.client.getThermostatData(),
      async (err, res) => {
        if (err) {
          this.error(err);
          await this.setUnavailable(`${err}`).catch(this.error);
          // Automatically restart polling after the interval to recover from errors.
          setTimeout(() => this.startPolling(), this.intervalMs * 2);
          return;
        } else if (res) {
          this.detectCircuits(res);
          await this.updateCapabilityValues(res).catch(this.error);
          await this.setAvailable().catch(this.error);
          await this.triggerFlows(res).catch(this.error);
        }
      }
    );
  }

  public restartPollingAfterWrite() {
    this.stopPolling?.();
    setTimeout(() => this.startPolling(), this.intervalMs);
  }

  private async triggerFlows(newData: ThermostatData) {
    const newHc1 = newData.hc1;
    const oldHc1 = this.oldData?.hc1;
    this.oldData = newData;
    if (
      oldHc1 &&
      newHc1 &&
      oldHc1.hpoperatingstate !== newHc1.hpoperatingstate
    ) {
      await this.hpoperatingstateChangedTrigger?.trigger(
        this,
        {
          old_value: capitalize(oldHc1.hpoperatingstate),
          new_value: capitalize(newHc1.hpoperatingstate),
        },
        undefined
      );
    }
  }

  private async updateCapabilityValues(data: ThermostatData) {
    if (!data.hc1) {
      this.log("No thermostat hc1 data");
      return;
    }

    // Init target_temperature to the actual value from the thermostat
    if (this.getCapabilityValue("target_temperature") === null) {
      await this.setCapabilityValue("target_temperature", data.hc1.seltemp);
    }

    const {
      dampedoutdoortemp,
      hc1: { seltemp, hpoperatingstate },
    } = data;
    await setCapabilityValues(this, [
      ["thermostat_dampedoutdoortemp", dampedoutdoortemp],
      ["thermostat_hc1_hpoperatingstate", capitalize(hpoperatingstate)],
      ["measure_temperature", seltemp],
    ]);
  }

  async onInit() {
    this.hpoperatingstateChangedTrigger = this.homey.flow.getDeviceTriggerCard(
      "thermostat_hc1_hpoperatingstate_changed"
    );

    this.registerCapabilityListener("target_temperature", async (value) => {
      this.log(`Updating selected temperature to ${value}°C`);
      try {
        this.setCapabilityValue("target_temperature", value).catch(this.error);
        if (this.oldData?.hc1?.seltemp === value) {
          this.log(`Don't update selected temperature, is already ${value}°C`);
          return;
        }
        this.stopPolling?.();
        await this.client.setHcSelectedTemp(1, value).catch(this.error);
        this.log(`Selected temperature updated to ${value}°C`);
      } catch (err) {
        this.error("Failed to update selected temperature", err);
        this.setUnavailable(`${err}`).catch(this.error);
      } finally {
        // Don't start polling until the thermostat has been updated
        setTimeout(() => this.startPolling(), this.intervalMs);
      }
    });

    this.homey.flow
      .getConditionCard("outdoor-temp-less-than")
      .registerRunListener(async (args: { temp: number }) => {
        const temp = this.oldData?.dampedoutdoortemp;
        return temp != null && temp < args.temp;
      });

    this.homey.flow
      .getConditionCard("outdoor-temp-greater-than")
      .registerRunListener(async (args: { temp: number }) => {
        const temp = this.oldData?.dampedoutdoortemp;
        return temp != null && temp > args.temp;
      });

    this.startPolling();
  }

  onDeleted() {
    this.stopPolling?.();
  }
}

module.exports = ThermostatDevice;
