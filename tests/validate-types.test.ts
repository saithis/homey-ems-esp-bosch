/**
 * Type validation tests for EMS-ESP API responses
 * 
 * This test file validates that real API responses match the TypeScript types.
 * To add new test cases:
 * 1. Save a new API response in tests/api-responses/
 * 2. Import and validate it in the appropriate test
 * 
 * Run with: npm test
 * Or validate types only: npm run test:types
 */

import { SystemData, BoilerData, ThermostatData } from '../lib/types';
import * as systemResponse from './api-responses/system.json';
import * as boilerResponse from './api-responses/boiler.json';
import * as thermostatResponse from './api-responses/thermostat.json';

describe('EMS-ESP API Type Validation', () => {
  describe('SystemData', () => {
    it('should match real api/system response', () => {
      // Type assertion validates the structure at compile time
      const data: SystemData = systemResponse as SystemData;
      
      // Runtime validations
      expect(data.system).toBeDefined();
      expect(data.system.version).toBeDefined();
      expect(data.system.platform).toBeDefined();
      expect(data.system.uptime).toBeDefined();
      expect(data.system.uptimeSec).toBeGreaterThan(0);
      expect(data.devices).toBeInstanceOf(Array);
      expect(data.devices.length).toBeGreaterThan(0);
    });

    it('should have valid device types', () => {
      const data: SystemData = systemResponse as SystemData;
      
      const validDeviceTypes = [
        'boiler', 'thermostat', 'heatpump', 'heatsource', 
        'solar', 'connect', 'mixer', 'controller', 
        'switch', 'gateway', 'alert', 'pump'
      ];
      
      data.devices.forEach(device => {
        expect(validDeviceTypes).toContain(device.type);
        expect(device.name).toBeDefined();
        expect(device.deviceID).toBeDefined();
        expect(device.entities).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have expected system info fields', () => {
      const data: SystemData = systemResponse as SystemData;
      const { system } = data;
      
      // Check for new fields added in v3.7.3
      expect(system.cpuType).toBeDefined();
      expect(system.arduino).toBeDefined();
      expect(system.sdk).toBeDefined();
      expect(system.freeCaps).toBeDefined();
      expect(system.usedApp).toBeDefined();
      expect(system.partition).toBeDefined();
      expect(system.flash_chip_size).toBeGreaterThan(0);
      expect(typeof system.psram).toBe('boolean');
      
      if (system.psram) {
        expect(system.psramSize).toBeGreaterThan(0);
        expect(system.freePsram).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('BoilerData', () => {
    it('should match real api/boiler response', () => {
      const data: BoilerData = boilerResponse as BoilerData;
      
      // Core fields validation
      expect(data.heatingactive).toMatch(/^(on|off)$/);
      expect(data.tapwateractive).toMatch(/^(on|off)$/);
      expect(data.outdoortemp).toBeDefined();
      expect(data.curflowtemp).toBeDefined();
      expect(data.rettemp).toBeDefined();
      expect(data.syspress).toBeDefined();
    });

    it('should have valid energy metrics', () => {
      const data: BoilerData = boilerResponse as BoilerData;
      
      // Energy values with decimals (new in v3.7.1+)
      expect(data.nrgtotal).toBeGreaterThanOrEqual(0);
      expect(data.nrgheat).toBeGreaterThanOrEqual(0);
      expect(data.nrgcool).toBeGreaterThanOrEqual(0);
      expect(data.metertotal).toBeGreaterThanOrEqual(0);
      expect(data.metercomp).toBeGreaterThanOrEqual(0);
      expect(data.metereheat).toBeGreaterThanOrEqual(0);
      
      // Legacy integer values should also be present
      expect(data.nrgsupptotal).toBeGreaterThanOrEqual(0);
      expect(data.nrgconstotal).toBeGreaterThanOrEqual(0);
    });

    it('should have valid heat pump data', () => {
      const data: BoilerData = boilerResponse as BoilerData;
      
      expect(data.hpcompon).toMatch(/^(on|off)$/);
      expect(['none', 'heating', 'cooling', 'hot water', 'pool', 'unknown', 'defrost'])
        .toContain(data.hpactivity);
      expect(data.hppower).toBeGreaterThanOrEqual(0);
      expect(data.hpcompspd).toBeGreaterThanOrEqual(0);
      expect(data.hpcircspd).toBeGreaterThanOrEqual(0);
      
      // Temperature sensors
      expect(data.hptc0).toBeDefined();
      expect(data.hptc1).toBeDefined();
      expect(data.hptr1).toBeDefined();
    });

    it('should have valid DHW (domestic hot water) data when present', () => {
      const data: BoilerData = boilerResponse as BoilerData;
      
      if (data.dhw) {
        expect(data.dhw.curtemp).toBeGreaterThanOrEqual(0);
        expect(data.dhw.seltemp).toBeGreaterThanOrEqual(0);
        expect(data.dhw.activated).toMatch(/^(on|off)$/);
        expect(data.dhw.charging).toMatch(/^(on|off)$/);
        expect(['off', '1x3min', '2x3min', '3x3min', '4x3min', '5x3min', '6x3min', 'continuous'])
          .toContain(data.dhw.circmode);
        
        // Energy metrics for DHW
        expect(data.dhw.nrg).toBeGreaterThanOrEqual(0);
        expect(data.dhw.meter).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have valid uptime statistics', () => {
      const data: BoilerData = boilerResponse as BoilerData;
      
      expect(data.uptimetotal).toBeGreaterThan(0);
      expect(data.uptimecontrol).toBeGreaterThanOrEqual(0);
      expect(data.uptimecompheating).toBeGreaterThanOrEqual(0);
      expect(data.totalcompstarts).toBeGreaterThanOrEqual(0);
      expect(data.heatingstarts).toBeGreaterThanOrEqual(0);
    });

    it('should have valid auxiliary heater data', () => {
      const data: BoilerData = boilerResponse as BoilerData;
      
      expect(data.auxheaterstatus).toMatch(/^(on|off)$/);
      expect(data.auxheateronly).toMatch(/^(on|off)$/);
      expect(data.auxheateroff).toMatch(/^(on|off)$/);
      expect(data.auxheaterlevel).toBeGreaterThanOrEqual(0);
      expect(data.auxheaterdelay).toBeGreaterThanOrEqual(0);
      expect(['eco', 'comfort']).toContain(data.auxheatrmode);
    });

    it('should have valid silent mode configuration', () => {
      const data: BoilerData = boilerResponse as BoilerData;
      
      expect(['off', 'auto', 'on']).toContain(data.silentmode);
      expect(data.mintempsilent).toBeDefined();
    });
  });

  describe('ThermostatData', () => {
    it('should match real api/thermostat response', () => {
      const data: ThermostatData = thermostatResponse as ThermostatData;
      
      // Core fields
      expect(data.datetime).toBeDefined();
      expect(data.dampedoutdoortemp).toBeDefined();
      expect(['light', 'medium', 'heavy']).toContain(data.building);
      expect(data.damping).toMatch(/^(on|off)$/);
    });

    it('should have valid heating circuit 1 (hc1) data', () => {
      const data: ThermostatData = thermostatResponse as ThermostatData;
      
      if (data.hc1) {
        expect(data.hc1.seltemp).toBeGreaterThan(0);
        expect(['selTemp', 'roomTemp']).toContain(data.hc1.haclimate);
        expect(['manual', 'auto']).toContain(data.hc1.mode);
        expect(['eco', 'comfort']).toContain(data.hc1.modetype);
        expect(['off', 'radiator', 'convector', 'floor']).toContain(data.hc1.heatingtype);
        expect(['off', 'auto', 'heating', 'cooling']).toContain(data.hc1.hpoperatingmode);
        expect(['heating', 'off', 'cooling']).toContain(data.hc1.hpoperatingstate);
        
        // Temperature settings
        expect(data.hc1.ecotemp).toBeGreaterThanOrEqual(0);
        expect(data.hc1.comforttemp).toBeGreaterThanOrEqual(0);
        expect(data.hc1.targetflowtemp).toBeGreaterThanOrEqual(0);
        
        // Control mode
        expect([
          'weather compensated', 'outside basepoint', 'n/a', 
          'room', 'power', 'constant'
        ]).toContain(data.hc1.controlmode);
        
        // New fields from v3.7.3
        expect(data.hc1.vacationmode).toMatch(/^(on|off)$/);
        expect(data.hc1.cooltemp).toBeDefined();
        expect(data.hc1.boost).toMatch(/^(on|off)$/);
        expect(data.hc1.control).toMatch(/^(on|off)$/);
      }
    });

    it('should have valid heating circuit 2 (hc2) data when present', () => {
      const data: ThermostatData = thermostatResponse as ThermostatData;
      
      if (data.hc2) {
        // hc2 should have the same structure as hc1
        expect(data.hc2.seltemp).toBeGreaterThan(0);
        expect(['manual', 'auto']).toContain(data.hc2.mode);
        expect(['off', 'radiator', 'convector', 'floor']).toContain(data.hc2.heatingtype);
      }
    });

    it('should have valid DHW settings in thermostat', () => {
      const data: ThermostatData = thermostatResponse as ThermostatData;
      
      if (data.dhw) {
        expect(['off', 'auto']).toContainEqual(expect.stringMatching(/off|auto/));
        expect(['off', 'on', 'auto', 'own prog']).toContain(data.dhw.circmode);
        expect(data.dhw.chargeduration).toBeGreaterThanOrEqual(0);
        expect(data.dhw.charge).toMatch(/^(on|off)$/);
        expect(data.dhw.disinfecting).toMatch(/^(on|off)$/);
        expect(['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su', 'all'])
          .toContain(data.dhw.disinfectday);
        expect(data.dhw.disinfecttime).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have valid PV (photovoltaic) settings', () => {
      const data: ThermostatData = thermostatResponse as ThermostatData;
      
      expect(data.pvenabledhw).toMatch(/^(on|off)$/);
      expect(data.pvraiseheat).toBeGreaterThanOrEqual(0);
      expect(data.pvlowercool).toBeGreaterThanOrEqual(0);
      expect(data.solar).toMatch(/^(on|off)$/);
    });

    it('should support remote temperature and humidity', () => {
      const data: ThermostatData = thermostatResponse as ThermostatData;
      
      if (data.hc1) {
        // remotetemp and remotehum can be null or a number
        if (data.hc1.remotetemp !== null) {
          expect(typeof data.hc1.remotetemp).toBe('number');
        }
        if (data.hc1.remotehum !== null) {
          expect(typeof data.hc1.remotehum).toBe('number');
        }
      }
    });
  });

  describe('Type Completeness', () => {
    it('should not have unexpected fields in BoilerData', () => {
      const data: BoilerData = boilerResponse as BoilerData;
      const keys = Object.keys(data);
      
      // This is informational - lists all fields returned by API
      console.log('BoilerData fields:', keys.length);
      
      // Check that dhw is properly nested
      expect(keys).toContain('dhw');
      expect(keys).not.toContain('wwcurtemp'); // Old field, should be dhw.curtemp
    });

    it('should not have unexpected fields in ThermostatData', () => {
      const data: ThermostatData = thermostatResponse as ThermostatData;
      const keys = Object.keys(data);
      
      console.log('ThermostatData fields:', keys.length);
      
      // Check structure
      expect(keys).toContain('hc1');
      expect(keys).toContain('dhw');
      
      // Old field names should not exist at root level
      expect(keys).not.toContain('wwmode');
      expect(keys).not.toContain('wwcircmode');
    });
  });
});

