# EMS-ESP Type Validation Tests

This directory contains tests that validate TypeScript types against real EMS-ESP API responses.

## Directory Structure

```
tests/
├── api-responses/          # Real API response samples
│   ├── boiler.json        # api/boiler response
│   ├── thermostat.json    # api/thermostat response
│   └── system.json        # api/system response
├── validate-types.ts      # Runtime validation script
├── validate-types.test.ts # Jest test suite (optional)
└── README.md             # This file
```

## Running Tests

### Quick Test
```bash
npm test
```

### Type Checking Only
```bash
npm run test:types:compile
```

### Full Validation
```bash
npm run test:types
```

## Adding New Test Data

When you get a new API response from your EMS-ESP device:

1. **Save the response** to `tests/api-responses/`:
   ```bash
   # Example: Get fresh data from your device
   curl http://ems-esp/api/boiler > tests/api-responses/boiler.json
   curl http://ems-esp/api/thermostat > tests/api-responses/thermostat.json
   curl http://ems-esp/api/system > tests/api-responses/system.json
   ```

2. **Run the tests**:
   ```bash
   npm test
   ```

3. **If tests fail**, it means the API structure has changed:
   - Check the error messages to see what's different
   - Update `lib/types.ts` to match the new structure
   - Rebuild: `npm run build`
   - Test again: `npm test`

## What Gets Validated

### SystemData
- ✓ System information (version, platform, uptime)
- ✓ Device list and types
- ✓ System resources (memory, flash, PSRAM)

### BoilerData
- ✓ Core heating/cooling status
- ✓ Temperature sensors (outdoor, flow, return, etc.)
- ✓ Energy metrics (kWh with decimals)
- ✓ Heat pump data (activity, speeds, sensors)
- ✓ DHW (domestic hot water) nested structure
- ✓ Auxiliary heater settings
- ✓ Silent mode configuration
- ✓ Uptime statistics

### ThermostatData
- ✓ Building and outdoor temperature
- ✓ Heating circuits (hc1, hc2)
- ✓ Operating modes and states
- ✓ Temperature settings (eco, comfort, manual)
- ✓ DHW settings (circulation, disinfection)
- ✓ PV (photovoltaic) integration
- ✓ Remote temperature/humidity support

## Example: Testing After EMS-ESP Update

```bash
# 1. Update EMS-ESP firmware on your device

# 2. Fetch new API responses
curl http://ems-esp/api/system | jq . > tests/api-responses/system.json
curl http://ems-esp/api/boiler | jq . > tests/api-responses/boiler.json
curl http://ems-esp/api/thermostat | jq . > tests/api-responses/thermostat.json

# 3. Run validation
npm test

# 4. If there are errors, update types and rebuild
# Edit lib/types.ts
npm run build
npm test
```

## Troubleshooting

### Test fails with "Module not found"
```bash
npm install
```

### TypeScript compilation errors
Check that `lib/types.ts` matches the structure in `api-responses/*.json`:
```bash
npm run test:types:compile
```

### Values don't match expected types
The test will show which field failed validation. Common issues:
- Enum values changed (e.g., new operating mode added)
- Field type changed (string to number, or vice versa)
- New required fields added
- Fields removed or renamed

## Device Information

Current test data is from:
- **Device**: Bosch Compress 6800iAW (CS6800i)
- **EMS-ESP Version**: 3.7.3-dev.14
- **Capture Date**: 2025-11-30

## Contributing

When updating types:
1. Keep the real API responses in `api-responses/` up to date
2. Document any breaking changes
3. Ensure backward compatibility where possible
4. Run tests before committing: `npm test && npm run build`

