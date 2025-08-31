# Distinct Value Changes Flow Card

## Overview

The **Distinct Value Changes** flow card is a powerful tool that prevents message spam while allowing different entities to trigger independently. It triggers immediately when a value changes but then blocks follow-up triggers with the same value until there's a gap of no events for the configured time. It's perfect for scenarios where you want immediate notification when values change but don't want to get spammed with repeated alerts for the same value.

## Use Case Example

**Scenario**: You have multiple rooms with temperature sensors, and you want to be notified immediately when any room's temperature changes. However, you don't want to get spammed with notifications if a single room's temperature stays the same.

**Solution**: Use the Distinct Value Changes flow card to create separate distinct value tracking for each room.

## Flow Setup

1. **Trigger**: Temperature sensor detects temperature change
2. **Logic**: Check if temperature has changed
3. **Distinct**: Use the "Distinct value changes" card
4. **Action**: Send notification message

## Configuration

### Parameters

- **Distinct time (seconds)**: How long to wait after the last event before allowing the same value to trigger again (1-3600 seconds)
- **Entity identifier**: The key that uniquely identifies each entity (e.g., room name, device ID)
- **Value identifier**: The key that contains the value to check for distinctness (e.g., temperature, humidity, status)

### Entity Identifier Examples

The entity identifier should be a token from a previous card that uniquely identifies each entity:

- `$room_name` - If you have a room name token
- `$device_id` - If you have a device ID token
- `$location` - If you have a location token
- `Living Room` - Direct text value (less flexible)

### Value Identifier Examples

The value identifier should be a token from a previous card that contains the value to track:

- `$temperature` - If you have a temperature token
- `$humidity` - If you have a humidity token
- `$status` - If you have a status token
- `$value` - If you have a generic value token

## How It Works

1. **First Trigger**: When an entity triggers for the first time, it's **immediately allowed** through and the value is recorded
2. **Value Change**: If the same entity triggers with a different value, it's **immediately allowed** through and the new value is recorded
3. **Same Value**: If the same entity tries to trigger with the same value while in the distinct time window, it's **blocked**
4. **Different Entities**: Other entities can still trigger independently, even if one is currently tracking a value
5. **Time Expiry**: Once the distinct time window expires, that entity can trigger again with the same value

## Example Flow

```
[Temperature Sensor] → [Logic: Temperature changed] → [Distinct: 300s per room] → [Send Message]
```

### Detailed Flow Steps

1. **Living Room** temperature changes from 20°C to 22°C → **Immediately Allowed** (new value)
2. **Living Room** temperature stays at 22°C → **Blocked** (same value, in distinct time window)
3. **Kitchen** temperature changes from 18°C to 19°C → **Immediately Allowed** (different entity)
4. **Living Room** temperature changes from 22°C to 21°C → **Immediately Allowed** (new value)
5. **Living Room** temperature stays at 21°C after 5 minutes → **Allowed** (distinct time expired)

## Benefits

- **Immediate Response**: First notification arrives instantly when values change
- **Prevents Spam**: No more repeated notifications for the same value
- **Entity Isolation**: Different entities can trigger independently
- **Value Tracking**: Automatically tracks and compares values
- **Configurable Timing**: Adjust distinct time based on your needs
- **Flexible Identification**: Use any token or value to identify entities and values

## Best Practices

1. **Choose Appropriate Distinct Time**: 
   - Short time (1-5 minutes): For critical alerts that need quick re-notification
   - Medium time (5-30 minutes): For general notifications
   - Long time (30+ minutes): For infrequent updates

2. **Select Meaningful Entity Identifiers**:
   - Use tokens that uniquely identify each entity
   - Avoid generic identifiers that might cause conflicts

3. **Select Meaningful Value Identifiers**:
   - Use tokens that contain the actual values to track
   - Ensure the values are comparable (numbers, strings, etc.)

4. **Test Your Flow**:
   - Verify that the first trigger is immediate
   - Ensure value changes are always allowed
   - Test that same values are blocked during the distinct time window
   - Verify that different entities can still trigger independently

## Technical Details

- **Memory Efficient**: Automatically cleans up expired tracking
- **Thread Safe**: Handles multiple concurrent triggers safely
- **Logging**: Provides detailed logging for debugging
- **Error Handling**: Gracefully handles invalid configurations
- **Value Comparison**: Supports primitive types and complex objects

## Troubleshooting

### Common Issues

1. **Entity Always Blocked**: Check if the entity identifier is correct and unique
2. **All Entities Blocked**: Verify the distinct time isn't set too high
3. **Flow Not Working**: Ensure the flow card is properly connected
4. **Values Not Being Tracked**: Check if the value identifier is correct

### Debug Tips

- Check the Homey logs for distinct-related messages
- Verify that the entity identifier token is being passed correctly
- Verify that the value identifier token is being passed correctly
- Test with a short distinct time first (e.g., 10 seconds)
- Use the logging to see what values are being compared

## Comparison with Cooldown Flow Card

| Feature | Cooldown Flow Card | Distinct Flow Card |
|---------|-------------------|-------------------|
| **Purpose** | Prevents spam by time-based blocking | Prevents spam by value-based blocking |
| **Trigger Logic** | Blocks based on time since last trigger | Blocks based on value changes and time |
| **Use Case** | When you want to limit frequency regardless of value | When you want to limit frequency for same values |
| **Parameters** | Cooldown time, Entity identifier | Distinct time, Entity identifier, Value identifier |
| **Behavior** | First trigger allowed, then blocks for cooldown period | First trigger allowed, value changes always allowed, same values blocked for distinct period |

## Version History

- **v1.0.0**: Initial release with distinct value functionality
- Support for multiple entities with separate value tracking
- Immediate triggers for value changes
- Time-based blocking for repeated same values
- Configurable distinct time (1-3600 seconds)
- Multi-language support (English, Swedish, Slovak)
