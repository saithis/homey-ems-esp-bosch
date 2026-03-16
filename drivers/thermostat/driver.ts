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
        this.log(
          `Setting HC${hcId} target temp to ${args.temperature}°C`
        );
        device.restartPollingAfterWrite();
        await device.client.setHcSelectedTemp(hcId, args.temperature);
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
        const currentTemp = hcData.seltemp;
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
        enabled: string;
        device: ThermostatDevice;
      }) => {
        const device = args.device;
        const hcId = Number(args.circuit.id);
        const enabled = args.enabled === "on";
        this.log(
          `Setting HC${hcId} summer mode to ${enabled ? "on" : "off"}`
        );
        await device.client.setHcSummerMode(hcId, enabled);
      }
    );
  }

  async onPair(session: Homey.Driver.PairSession): Promise<void> {
    driverOnPair(this, session, "thermostat");
  }
}

module.exports = ThermostatDriver;
