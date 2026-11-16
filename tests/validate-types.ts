#!/usr/bin/env node
/**
 * TypeScript Type Validation Script
 * 
 * This script validates that real API responses match the TypeScript types.
 * It performs compile-time type checking and runtime structure validation.
 * 
 * Usage:
 *   npm run test:types
 *   
 * To add new test data:
 *   1. Save API response as JSON in tests/api-responses/
 *   2. Import and validate in this script
 */

import { SystemData, BoilerData, ThermostatData } from '../lib/types';
import * as fs from 'fs';
import * as path from 'path';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

interface ValidationResult {
  name: string;
  passed: boolean;
  errors: string[];
}

const results: ValidationResult[] = [];

function validateBoolean(value: any, name: string): string[] {
  const errors: string[] = [];
  if (value !== 'on' && value !== 'off') {
    errors.push(`${name} should be 'on' or 'off', got: ${value}`);
  }
  return errors;
}

function validateNumber(value: any, name: string, min?: number): string[] {
  const errors: string[] = [];
  if (typeof value !== 'number') {
    errors.push(`${name} should be a number, got: ${typeof value}`);
  } else if (min !== undefined && value < min) {
    errors.push(`${name} should be >= ${min}, got: ${value}`);
  }
  return errors;
}

function validateEnum(value: any, name: string, validValues: string[]): string[] {
  const errors: string[] = [];
  if (!validValues.includes(value)) {
    errors.push(`${name} should be one of [${validValues.join(', ')}], got: ${value}`);
  }
  return errors;
}

function loadJsonFile<T>(filename: string): T {
  const filePath = path.join(__dirname, 'api-responses', filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

// Test 1: SystemData validation
function validateSystemData(): ValidationResult {
  const result: ValidationResult = { name: 'SystemData', passed: true, errors: [] };
  
  try {
    const data: SystemData = loadJsonFile<SystemData>('system.json');
    
    // Validate system info
    if (!data.system) result.errors.push('Missing system object');
    if (!data.system?.version) result.errors.push('Missing system.version');
    if (!data.system?.platform) result.errors.push('Missing system.platform');
    
    result.errors.push(...validateNumber(data.system?.uptimeSec, 'system.uptimeSec', 0));
    result.errors.push(...validateNumber(data.system?.freeMem, 'system.freeMem', 0));
    
    // Validate devices array
    if (!Array.isArray(data.devices)) {
      result.errors.push('devices should be an array');
    } else {
      const validDeviceTypes = [
        'boiler', 'thermostat', 'heatpump', 'heatsource',
        'solar', 'connect', 'mixer', 'controller',
        'switch', 'gateway', 'alert', 'pump'
      ];
      
      data.devices.forEach((device, index) => {
        result.errors.push(...validateEnum(
          device.type,
          `devices[${index}].type`,
          validDeviceTypes
        ));
        result.errors.push(...validateNumber(
          device.entities,
          `devices[${index}].entities`,
          0
        ));
      });
    }
    
    result.passed = result.errors.length === 0;
  } catch (error) {
    result.passed = false;
    result.errors.push(`Exception: ${error}`);
  }
  
  return result;
}

// Test 2: BoilerData validation
function validateBoilerData(): ValidationResult {
  const result: ValidationResult = { name: 'BoilerData', passed: true, errors: [] };
  
  try {
    const data: BoilerData = loadJsonFile<BoilerData>('boiler.json');
    
    // Core fields
    result.errors.push(...validateBoolean(data.heatingactive, 'heatingactive'));
    result.errors.push(...validateBoolean(data.tapwateractive, 'tapwateractive'));
    result.errors.push(...validateBoolean(data.heatingpump, 'heatingpump'));
    
    // Temperature fields
    result.errors.push(...validateNumber(data.outdoortemp, 'outdoortemp'));
    result.errors.push(...validateNumber(data.curflowtemp, 'curflowtemp'));
    result.errors.push(...validateNumber(data.rettemp, 'rettemp'));
    result.errors.push(...validateNumber(data.syspress, 'syspress', 0));
    
    // Energy metrics (with decimals)
    result.errors.push(...validateNumber(data.nrgtotal, 'nrgtotal', 0));
    result.errors.push(...validateNumber(data.nrgheat, 'nrgheat', 0));
    result.errors.push(...validateNumber(data.metertotal, 'metertotal', 0));
    
    // Heat pump
    result.errors.push(...validateBoolean(data.hpcompon, 'hpcompon'));
    result.errors.push(...validateEnum(
      data.hpactivity,
      'hpactivity',
      ['none', 'heating', 'cooling', 'hot water', 'pool', 'unknown', 'defrost']
    ));
    result.errors.push(...validateNumber(data.hppower, 'hppower', 0));
    
    // DHW validation
    if (data.dhw) {
      result.errors.push(...validateNumber(data.dhw.curtemp, 'dhw.curtemp', 0));
      result.errors.push(...validateNumber(data.dhw.seltemp, 'dhw.seltemp', 0));
      result.errors.push(...validateBoolean(data.dhw.activated, 'dhw.activated'));
      result.errors.push(...validateEnum(
        data.dhw.circmode,
        'dhw.circmode',
        ['off', '1x3min', '2x3min', '3x3min', '4x3min', '5x3min', '6x3min', 'continuous']
      ));
    }
    
    // Auxiliary heater
    result.errors.push(...validateBoolean(data.auxheaterstatus, 'auxheaterstatus'));
    result.errors.push(...validateEnum(data.auxheatrmode, 'auxheatrmode', ['eco', 'comfort']));
    
    // Silent mode
    result.errors.push(...validateEnum(data.silentmode, 'silentmode', ['off', 'auto', 'on']));
    
    result.passed = result.errors.length === 0;
  } catch (error) {
    result.passed = false;
    result.errors.push(`Exception: ${error}`);
  }
  
  return result;
}

// Test 3: ThermostatData validation
function validateThermostatData(): ValidationResult {
  const result: ValidationResult = { name: 'ThermostatData', passed: true, errors: [] };
  
  try {
    const data: ThermostatData = loadJsonFile<ThermostatData>('thermostat.json');
    
    // Core fields
    if (!data.datetime) result.errors.push('Missing datetime');
    result.errors.push(...validateNumber(data.dampedoutdoortemp, 'dampedoutdoortemp'));
    result.errors.push(...validateEnum(
      data.building,
      'building',
      ['light', 'medium', 'heavy']
    ));
    result.errors.push(...validateBoolean(data.damping, 'damping'));
    result.errors.push(...validateBoolean(data.solar, 'solar'));
    result.errors.push(...validateBoolean(data.pvenabledhw, 'pvenabledhw'));
    
    // Heating circuit 1
    if (data.hc1) {
      result.errors.push(...validateNumber(data.hc1.seltemp, 'hc1.seltemp', 0));
      result.errors.push(...validateEnum(
        data.hc1.haclimate,
        'hc1.haclimate',
        ['selTemp', 'roomTemp']
      ));
      result.errors.push(...validateEnum(
        data.hc1.mode,
        'hc1.mode',
        ['manual', 'auto']
      ));
      result.errors.push(...validateEnum(
        data.hc1.modetype,
        'hc1.modetype',
        ['eco', 'comfort']
      ));
      result.errors.push(...validateEnum(
        data.hc1.heatingtype,
        'hc1.heatingtype',
        ['off', 'radiator', 'convector', 'floor']
      ));
      result.errors.push(...validateEnum(
        data.hc1.hpoperatingmode,
        'hc1.hpoperatingmode',
        ['off', 'auto', 'heating', 'cooling']
      ));
      result.errors.push(...validateEnum(
        data.hc1.hpoperatingstate,
        'hc1.hpoperatingstate',
        ['heating', 'off', 'cooling']
      ));
      result.errors.push(...validateBoolean(data.hc1.vacationmode, 'hc1.vacationmode'));
      result.errors.push(...validateBoolean(data.hc1.boost, 'hc1.boost'));
    }
    
    // DHW thermostat settings
    if (data.dhw) {
      result.errors.push(...validateEnum(
        data.dhw.circmode,
        'dhw.circmode',
        ['off', 'on', 'auto', 'own prog']
      ));
      result.errors.push(...validateBoolean(data.dhw.charge, 'dhw.charge'));
      result.errors.push(...validateBoolean(data.dhw.disinfecting, 'dhw.disinfecting'));
      result.errors.push(...validateEnum(
        data.dhw.disinfectday,
        'dhw.disinfectday',
        ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su', 'all']
      ));
    }
    
    result.passed = result.errors.length === 0;
  } catch (error) {
    result.passed = false;
    result.errors.push(`Exception: ${error}`);
  }
  
  return result;
}

// Run all validations
function runValidation() {
  console.log(`${colors.blue}==============================================`);
  console.log('EMS-ESP TypeScript Type Validation');
  console.log(`==============================================${colors.reset}\n`);
  
  results.push(validateSystemData());
  results.push(validateBoilerData());
  results.push(validateThermostatData());
  
  // Print results
  let allPassed = true;
  results.forEach(result => {
    const symbol = result.passed ? '✓' : '✗';
    const color = result.passed ? colors.green : colors.red;
    
    console.log(`${color}${symbol} ${result.name}${colors.reset}`);
    
    if (!result.passed) {
      allPassed = false;
      result.errors.forEach(error => {
        console.log(`  ${colors.red}• ${error}${colors.reset}`);
      });
      console.log();
    }
  });
  
  // Summary
  console.log(`\n${colors.blue}==============================================${colors.reset}`);
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const summaryColor = allPassed ? colors.green : colors.red;
  
  console.log(`${summaryColor}Results: ${passed}/${total} passed${colors.reset}`);
  
  if (allPassed) {
    console.log(`${colors.green}✓ All types match real API responses!${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Some validations failed. Please review errors above.${colors.reset}`);
  }
  
  console.log(`${colors.blue}==============================================${colors.reset}\n`);
  
  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Execute validation
runValidation();

