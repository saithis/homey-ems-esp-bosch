import Homey from "homey";
import { driverOnPair } from "../../lib/utils";

// Import the device type for accessing detected circuits
type ThermostatDevice = InstanceType<
  typeof import("./device") extends { default: infer T } ? T : any
> & {
  detectedCircuits: number[];
  client: import("../../lib/ems-esp-client").EmsEspClient;
  getHcData(hcId: number): import("../../lib/types").HeatingCircuit | undefined;
  restartPollingAfterWrite(): void;
};

class ThermostatDriver extends Homey.Driver {
  private circuitAutocomplete = async (
    query: string,
    args: { device: ThermostatDevice }
  ) => {
    return args.device.detectedCircuits
      .map((id: number) => ({ name: `HC${id}`, id: String(id) }))
      .filter((c: { name: string }) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      );
  };

  async onInit() {
    this.homey.flow
      .getDeviceTriggerCard("thermostat_hc1_hpoperatingstate_changed")
      .registerRunListener(async (args, state) => {
        this.log(
          "Trigger thermostat_hc1_hpoperatingstate_changed has been triggered",
          args,
          state
        );
        return true;
      });

    this.homey.flow
      .getDeviceTriggerCard("thermostat_outdoor_temp_crossed_above")
      .registerRunListener(
        async (
          args: { temp: number },
          state: { oldTemp: number; newTemp: number }
        ) => {
          return state.oldTemp <= args.temp && state.newTemp > args.temp;
        }
      );

    this.homey.flow
      .getDeviceTriggerCard("thermostat_outdoor_temp_crossed_below")
      .registerRunListener(
        async (
          args: { temp: number },
          state: { oldTemp: number; newTemp: number }
        ) => {
          return state.oldTemp >= args.temp && state.newTemp < args.temp;
        }
      );

    // --- Action card: Set HC target temperature ---
    const setTempCard = this.homey.flow.getActionCard(
      "thermostat_set_hc_target_temp"
    );
    setTempCard.registerArgumentAutocompleteListener(
      "circuit",
      this.circuitAutocomplete
    );
    setTempCard.registerRunListener(
      async (args: {
        circuit: { id: string; name: string };
        temperature: number;
        device: ThermostatDevice;
      }) => {
        const device = args.device;
        const hcId = Number(args.circuit.id);
        const hcData = device.getHcData(hcId);
        const oldTemp = hcData?.seltemp ?? 0;
        this.log(
          `Setting HC${hcId} target temp to ${args.temperature}°C (was ${oldTemp}°C)`
        );
        device.restartPollingAfterWrite();
        await device.client.setHcSelectedTemp(hcId, args.temperature);
        if (hcData) {
          hcData.seltemp = args.temperature;
          if (hcData.mode === "manual") {
            hcData.manualtemp = args.temperature;
          }
        }
        return { old_temperature: oldTemp };
      }
    );

    // --- Action card: Adjust HC target temperature offset ---
    const adjustTempCard = this.homey.flow.getActionCard(
      "thermostat_adjust_hc_target_temp_offset"
    );
    adjustTempCard.registerArgumentAutocompleteListener(
      "circuit",
      this.circuitAutocomplete
    );
    adjustTempCard.registerRunListener(
      async (args: {
        circuit: { id: string; name: string };
        offset: number;
        device: ThermostatDevice;
      }) => {
        const device = args.device;
        const hcId = Number(args.circuit.id);
        const hcData = device.getHcData(hcId);
        if (!hcData) {
          throw new Error(`Heating circuit HC${hcId} not found`);
        }
        const minValidTemp = hcData.nofrosttemp ?? 5;
        const currentTemp =
          hcData.seltemp > minValidTemp
            ? hcData.seltemp
            : hcData.comforttemp || hcData.manualtemp || hcData.ecotemp || 21;
        const newTemp = Math.min(30, Math.max(5, currentTemp + args.offset));
        if (newTemp !== currentTemp + args.offset) {
          this.log(
            `Clamped HC${hcId} target temp: ${currentTemp} + ${args.offset} = ${currentTemp + args.offset} → ${newTemp}°C`
          );
        }
        this.log(
          `Adjusting HC${hcId} target temp: ${currentTemp} + ${args.offset} = ${newTemp}°C`
        );
        device.restartPollingAfterWrite();
        await device.client.setHcSelectedTemp(hcId, newTemp);
        hcData.seltemp = newTemp;
        if (hcData.mode === "manual") {
          hcData.manualtemp = newTemp;
        }
        return { old_temperature: currentTemp };
      }
    );

    // --- Action card: Set HC summer mode ---
    const summerModeCard = this.homey.flow.getActionCard(
      "thermostat_set_hc_summer_mode"
    );
    summerModeCard.registerArgumentAutocompleteListener(
      "circuit",
      this.circuitAutocomplete
    );
    summerModeCard.registerRunListener(
      async (args: {
        circuit: { id: string; name: string };
        mode: "summer" | "auto" | "winter";
        device: ThermostatDevice;
      }) => {
        const device = args.device;
        const hcId = Number(args.circuit.id);
        this.log(`Setting HC${hcId} summer mode to ${args.mode}`);
        device.restartPollingAfterWrite();
        await device.client.setHcSummerMode(hcId, args.mode);
      }
    );

    // --- Action card: Set HC operating mode ---
    const modeCard = this.homey.flow.getActionCard(
      "thermostat_set_hc_mode"
    );
    modeCard.registerArgumentAutocompleteListener(
      "circuit",
      this.circuitAutocomplete
    );
    modeCard.registerRunListener(
      async (args: {
        circuit: { id: string; name: string };
        mode: "off" | "manual" | "auto";
        device: ThermostatDevice;
      }) => {
        const device = args.device;
        const hcId = Number(args.circuit.id);
        const hcData = device.getHcData(hcId);
        this.log(`Setting HC${hcId} operating mode to ${args.mode}`);
        device.restartPollingAfterWrite();

        // On Bosch RC300/UI800 controllers, EMS-ESP implements "off" mode by switching
        // to manual mode with manualtemp = 0°C. When switching back to "manual", restore
        // manualtemp if it was left at <= nofrosttemp (e.g. 0°C), otherwise the controller
        // remains in "off" state.
        if (args.mode === "manual" && hcData) {
          const minValidTemp = hcData.nofrosttemp ?? 5;
          if (hcData.manualtemp == null || hcData.manualtemp <= minValidTemp) {
            const fallbackTemp =
              hcData.comforttemp ||
              hcData.ecotemp ||
              (hcData.seltemp > minValidTemp ? hcData.seltemp : 21);
            this.log(
              `Restoring HC${hcId} manualtemp from ${hcData.manualtemp}°C to ${fallbackTemp}°C before entering manual mode`
            );
            await device.client.setHcManualTemp(hcId, fallbackTemp);
            hcData.manualtemp = fallbackTemp;
          }
        }

        await device.client.setHcMode(hcId, args.mode);
        if (hcData) {
          hcData.mode = args.mode;
          if (args.mode === "off") {
            hcData.seltemp = 0;
          } else if (args.mode === "manual" && hcData.manualtemp) {
            hcData.seltemp = hcData.manualtemp;
          } else if (args.mode === "auto" && hcData.comforttemp) {
            hcData.seltemp = hcData.comforttemp;
          }
        }
      }
    );
  }

  async onPair(session: Homey.Driver.PairSession): Promise<void> {
    driverOnPair(this, session, "thermostat");
  }
}

module.exports = ThermostatDriver;
