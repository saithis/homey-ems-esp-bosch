import { Mutex } from "async-mutex";

export type Settings = {
  network_address: string;
  access_token: string;
};

export type DeviceSettings = {
  networkAddress: string;
  accessToken: string;
  pollInterval: number;
  mutex: Mutex;
  timeout: NodeJS.Timeout | null;
};

export type SystemData = {
  system: SystemInfo;
  network: unknown;
  ntp: unknown;
  ota: unknown;
  mqtt: unknown;
  syslog: unknown;
  sensor: unknown;
  api: unknown;
  bus: unknown;
  settings: unknown;
  devices: Array<DeviceData>;
};

export interface SystemInfo {
  version: string;
  platform: string;
  uptime: string;
  uptimeSec: number;
  cpuType: string;
  arduino: string;
  sdk: string;
  freeMem: number;
  maxAlloc: number;
  freeCaps: number;
  usedApp: number;
  freeApp: number;
  partition: string;
  flash_chip_size: number;
  resetReason: string;
  psram: boolean;
  psramSize: number;
  freePsram: number;
  model: string;
};

export type DeviceType =
  | "boiler"
  | "thermostat"
  | "heatpump"
  | "heatsource"
  | "solar"
  | "connect"
  | "mixer"
  | "controller"
  | "switch"
  | "gateway"
  | "alert"
  | "pump";

export type DeviceData = {
  type: DeviceType;
  name: string;
  deviceID: string;
  productID: string;
  version: string;
  entities: number;
  handlersReceived: string;
  handlersFetched: string;
  handlersPending: string;
  handlersIgnored: string;
};

export type HeatingCircuit = {
  seltemp: number;
  haclimate: "selTemp" | "roomTemp";
  mode: "manual" | "auto";
  modetype: "eco" | "comfort";
  ecotemp: number;
  manualtemp: number;
  comforttemp: number;
  summertemp: number;
  designtemp: number;
  offsettemp: number;
  minflowtemp: number;
  maxflowtemp: number;
  roominfluence: number;
  roominflfactor: number;
  curroominfl: number;
  nofrostmode: "room" | "outdoor" | "room outdoor";
  nofrosttemp: number;
  targetflowtemp: number;
  heatingtype: "off" | "radiator" | "convector" | "floor";
  hpoperatingmode: "off" | "auto" | "heating" | "cooling";
  hpoperatingstate: "heating" | "off" | "cooling";
  vacationmode: "on" | "off";
  controlmode:
    | "weather compensated"
    | "outside basepoint"
    | "n/a"
    | "room"
    | "power"
    | "constant";
  program: "prog 1" | "prog 2";
  tempautotemp: number;
  cooltemp: number;
  fastheatup: number;
  switchonoptimization: "on" | "off";
  reducemode: "outdoor" | "room" | "reduce";
  noreducetemp: number;
  reducetemp: number;
  dhwprio: "on" | "off";
  hpcooling: "on" | "off";
  coolingon: "on" | "off";
  hpmode: "heating" | "cooling" | "heating&cooling";
  dewoffset: number;
  roomtempdiff: number;
  hpminflowtemp: number;
  control: "on" | "off";
  remotetemp: number | null;
  remotehum: number | null;
  heatondelay: number;
  heatoffdelay: number;
  instantstart: number;
  boost: "on" | "off";
  boosttime: number;
  coolstart: number;
  coolondelay: number;
  cooloffdelay: number;
  switchprogmode: "level" | string;
  redthreshold: number;
  solarinfl: number;
  currsolarinfl: number;
};

export type ThermostatData = {
  lastcode: string;
  datetime: string;
  intoffset: number;
  floordry: "off" | "start" | "heat" | "hold" | "cool" | "end";
  dampedoutdoortemp: number;
  floordrytemp: number;
  building: "light" | "medium" | "heavy";
  minexttemp: number;
  damping: "on" | "off";
  solar: "on" | "off";
  energycostratio: number;
  pvenabledhw: "on" | "off";
  pvraiseheat: number;
  pvlowercool: number;
  absent: "on" | "off";
  hc1?: HeatingCircuit;
  hc2?: HeatingCircuit;
  dhw?: {
    mode: "off" | "auto" | string;
    circmode: "off" | "on" | "auto" | "own prog";
    chargeduration: number;
    charge: "on" | "off";
    extra: "on" | "off";
    disinfecting: "on" | "off";
    disinfectday: "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su" | "all";
    disinfecttime: number;
    dailyheating: "on" | "off";
    dailyheattime: number;
  };
};

export type BoilerData = {
  reset: string;
  heatingoff: "on" | "off";
  heatingactive: "on" | "off";
  tapwateractive: "on" | "off";
  selflowtemp: number;
  heatingpumpmod: number;
  outdoortemp: number;
  curflowtemp: number;
  rettemp: number;
  switchtemp?: number;
  syspress: number;
  boiltemp?: number;
  headertemp: number;
  heatingactivated: "on" | "off";
  heatingtemp: number;
  heatingpump: "on" | "off";
  pumpmodmax: number;
  pumpmodmin: number;
  pumpmode?: "proportional" | "deltaP-1" | "deltaP-2" | "deltaP-3" | "deltaP-4";
  pumpcharacter: "proportional" | "150mbar" | "200mbar" | "250mbar" | "300mbar" | "350mbar" | "400mbar";
  pumpdelay?: number;
  pumpontemp?: number;
  selburnpow: number;
  curburnpow: number;
  burnstarts: number;
  burnworkmin: number;
  burn2workmin: number;
  heatworkmin: number;
  heatstarts: number;
  ubauptime: number;
  lastcode: string;
  emergencyops: "on" | "off";
  emergencytemp: number;
  pc0flow: number;
  pc1flow: number;
  pc1on: "on" | "off";
  pc1rate: number;
  nrgtotal: number;
  nrgheat: number;
  nrgcool: number;
  metertotal: number;
  metercomp: number;
  metereheat: number;
  meterheat: number;
  metercool: number;
  uptimetotal: number;
  uptimecontrol: number;
  uptimecompheating: number;
  uptimecompcooling: number;
  uptimecomppool: number;
  totalcompstarts: number;
  heatingstarts: number;
  coolingstarts: number;
  poolstarts: number;
  nrgconstotal: number;
  nrgconscomptotal: number;
  nrgconscompheating: number;
  nrgconscompcooling: number;
  auxelecheatnrgconstotal: number;
  auxelecheatnrgconsheating: number;
  auxelecheatnrgconspool: number;
  nrgsupptotal: number;
  nrgsuppheating: number;
  nrgsuppcooling: number;
  hppower: number;
  hpsetdiffpress: number;
  hpcompon: "on" | "off";
  hpactivity:
    | "none"
    | "heating"
    | "cooling"
    | "hot water"
    | "pool"
    | "unknown"
    | "defrost";
  hpbrinepumpspd: number;
  hpswitchvalve: "on" | "off";
  hpcompspd: number;
  hpcircspd: number;
  hpbrinein: number;
  hpbrineout: number;
  hptc0: number;
  hptc1: number;
  hptc3: number;
  hptr1: number;
  hptr3: number;
  hptr4: number;
  hptr5: number;
  hptr6: number;
  hptr7: number;
  hptl2: number;
  hppl1: number;
  hpph1: number;
  hpta4: number;
  hptw1: number;
  hp4way: "heating & dhw" | string;
  hpin1: "on" | "off";
  hpin1opt: string;
  hpin2: "on" | "off";
  hpin2opt: string;
  hpin3: "on" | "off";
  hpin3opt: string;
  hpin4: "on" | "off";
  hpin4opt: string;
  maxheatcomp: string;
  maxheatheat: string;
  auxheatersource: "electric heater" | string;
  pvcooling: "on" | "off";
  auxheateronly: "on" | "off";
  auxheateroff: "on" | "off";
  auxheaterstatus: "on" | "off";
  auxheaterlevel: number;
  auxheaterdelay: number;
  auxmaxlimit: number;
  auxlimitstart: number;
  auxheatrmode: "eco" | "comfort";
  silentmode: "off" | "auto" | "on";
  mintempsilent: number;
  tempparmode: number;
  auxheatmix: number;
  tempdiffheat: number;
  tempdiffcool: number;
  vpcooling: "on" | "off";
  heatcable: "on" | "off";
  vc0valve: "on" | "off";
  primepump: "on" | "off";
  primepumpmod: number;
  hp3way: "on" | "off";
  elheatstep1: "on" | "off";
  elheatstep2: "on" | "off";
  elheatstep3: "on" | "off";
  hpea0: "on" | "off";
  hppumpmode: "auto" | string;
  shutdown: string;
  dhw?: {
    nrg: number;
    meter: number;
    uptimecomp: number;
    startshp: number;
    nrgconscomp: number;
    auxelecheatnrgcons: number;
    nrgsupp: number;
    maxheat: string;
    alternatingop: "on" | "off";
    altopprioheat: number;
    altopprio: number;
    ecoplusoff: number;
    comfdiff: number;
    ecodiff: number;
    ecoplusdiff: number;
    comfstop: number;
    ecostop: number;
    ecoplusstop: number;
    settemp: number;
    seltemp: number;
    seltemplow: number;
    tempecoplus: number;
    seltempsingle: number;
    comfort1: string;
    flowtempoffset: number;
    circpump: "on" | "off";
    hyston: number;
    hystoff: number;
    disinfectiontemp: number;
    circmode:
      | "off"
      | "1x3min"
      | "2x3min"
      | "3x3min"
      | "4x3min"
      | "5x3min"
      | "6x3min"
      | "continuous";
    circ: "on" | "off";
    curtemp: number;
    curtemp2: number;
    curflow: number;
    activated: "on" | "off";
    onetime: "on" | "off";
    disinfecting: "on" | "off";
    charging: "on" | "off";
    recharging: "on" | "off";
    tempok: "on" | "off";
    "3wayvalve": "on" | "off";
    starts: number;
    workm: number;
  };
};
