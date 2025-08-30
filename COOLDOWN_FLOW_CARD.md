# Cooldown Value Changes Flow Card

## Overview

The **Cooldown Value Changes** flow card is a powerful tool that prevents message spam while allowing different entities to trigger independently. It triggers immediately on the first invocation but then blocks follow-up invocations until there's a gap of no events for the configured time. It's perfect for scenarios where you want immediate notification but don't want to get spammed with repeated alerts from the same entity.

## Use Case Example

**Scenario**: You have multiple rooms with humidity sensors, and you want to be notified immediately when any room's humidity goes above 60%. However, you don't want to get spammed with notifications if a single room's humidity hovers around the threshold.

**Solution**: Use the Cooldown Value Changes flow card to create separate cooldown timers for each room.

## Flow Setup

1. **Trigger**: Humidity sensor detects humidity > 60%
2. **Logic**: Check if humidity is above 60%
3. **Cooldown**: Use the "Cooldown value changes" card
4. **Action**: Send notification message

## Configuration

### Parameters

- **Cooldown time (seconds)**: How long to wait after the last event before allowing the same entity to trigger again (1-3600 seconds)
- **Entity identifier**: The key that uniquely identifies each entity (e.g., room name, device ID)

### Entity Identifier Examples

The entity identifier should be a token from a previous card that uniquely identifies each entity:

- `$room_name` - If you have a room name token
- `$device_id` - If you have a device ID token
- `$location` - If you have a location token
- `Living Room` - Direct text value (less flexible)

## How It Works

1. **First Trigger**: When an entity triggers for the first time, it's **immediately allowed** through and a cooldown timer starts
2. **Subsequent Triggers**: If the same entity tries to trigger again while in cooldown, it's **blocked**
3. **Different Entities**: Other entities can still trigger independently, even if one is currently in cooldown
4. **Cooldown Expiry**: Once the cooldown timer expires (after a gap of no events), that entity can trigger again

## Example Flow

```
[Humidity Sensor] → [Logic: Humidity > 60%] → [Cooldown: 300s per room] → [Send Message]
```

### Detailed Flow Steps

1. **Living Room** humidity goes above 60% → **Immediately Allowed** (starts cooldown)
2. **Living Room** humidity goes above 60% again within 5 minutes → **Blocked** (in cooldown)
3. **Kitchen** humidity goes above 60% → **Immediately Allowed** (different entity)
4. **Living Room** humidity goes above 60% after 5 minutes of no events → **Allowed** (cooldown expired)

## Benefits

- **Immediate Response**: First notification arrives instantly
- **Prevents Spam**: No more repeated notifications for the same issue
- **Entity Isolation**: Different entities can trigger independently
- **Configurable Timing**: Adjust cooldown time based on your needs
- **Flexible Identification**: Use any token or value to identify entities

## Best Practices

1. **Choose Appropriate Cooldown Time**: 
   - Short time (1-5 minutes): For critical alerts that need quick re-notification
   - Medium time (5-30 minutes): For general notifications
   - Long time (30+ minutes): For infrequent updates

2. **Select Meaningful Entity Identifiers**:
   - Use tokens that uniquely identify each entity
   - Avoid generic identifiers that might cause conflicts

3. **Test Your Flow**:
   - Verify that the first trigger is immediate
   - Ensure subsequent triggers are blocked during cooldown
   - Test that different entities can still trigger independently

## Technical Details

- **Memory Efficient**: Automatically cleans up expired timers
- **Thread Safe**: Handles multiple concurrent triggers safely
- **Logging**: Provides detailed logging for debugging
- **Error Handling**: Gracefully handles invalid configurations

## Troubleshooting

### Common Issues

1. **Entity Always Blocked**: Check if the entity identifier is correct and unique
2. **All Entities Blocked**: Verify the cooldown time isn't set too high
3. **Flow Not Working**: Ensure the flow card is properly connected

### Debug Tips

- Check the Homey logs for cooldown-related messages
- Verify that the entity identifier token is being passed correctly
- Test with a short cooldown time first (e.g., 10 seconds)

## Version History

- **v1.0.0**: Initial release with cooldown functionality
- Support for multiple entities with separate timers
- Immediate first trigger with subsequent cooldown blocking
- Configurable cooldown time (1-3600 seconds)
- Multi-language support (English, Swedish, Slovak)
