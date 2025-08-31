/**
 * EntityDistinct - A class that provides distinct value tracking functionality
 * It tracks unique values for entities and only allows triggers when the value changes
 * or when a certain time has passed since the last trigger for the same value
 */
export class EntityDistinct {
  private lastValues = new Map<string, any>();
  private lastTriggerTimes = new Map<string, number>();
  private distinctTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Check if an entity should be allowed to trigger based on distinct value settings
   * @param entityKey - The key that identifies the entity (e.g., room name, device ID)
   * @param currentValue - The current value to check against
   * @param distinctTimeMs - The time in milliseconds to wait before allowing the same value again
   * @returns true if the entity should be allowed to trigger, false if it should be blocked
   */
  public shouldTrigger(entityKey: string, currentValue: any, distinctTimeMs: number): boolean {
    const now = Date.now();
    const lastValue = this.lastValues.get(entityKey);
    const lastTriggerTime = this.lastTriggerTimes.get(entityKey);
    
    // If this is the first time this entity has triggered, always allow
    if (lastValue === undefined) {
      this.updateEntity(entityKey, currentValue, now);
      return true;
    }
    
    // If the value has changed, always allow
    if (this.isValueDifferent(lastValue, currentValue)) {
      this.updateEntity(entityKey, currentValue, now);
      return true;
    }
    
    // If the value is the same, check if enough time has passed
    if (lastTriggerTime && (now - lastTriggerTime) >= distinctTimeMs) {
      this.updateEntity(entityKey, currentValue, now);
      return true;
    }
    
    // Value is the same and not enough time has passed - block the trigger
    return false;
  }

  /**
   * Check if two values are different
   * @param value1 - First value to compare
   * @param value2 - Second value to compare
   * @returns true if the values are different
   */
  private isValueDifferent(value1: any, value2: any): boolean {
    // Handle different data types
    if (typeof value1 !== typeof value2) {
      return true;
    }
    
    // For objects and arrays, do deep comparison
    if (typeof value1 === 'object' && value1 !== null) {
      return JSON.stringify(value1) !== JSON.stringify(value2);
    }
    
    // For primitive types, use strict equality
    return value1 !== value2;
  }

  /**
   * Update the entity with new value and timestamp
   * @param entityKey - The key that identifies the entity
   * @param currentValue - The current value
   * @param timestamp - The current timestamp
   */
  private updateEntity(entityKey: string, currentValue: any, timestamp: number): void {
    // Clear any existing timer for this entity
    this.clearDistinctTimer(entityKey);
    
    // Update the last value and trigger time
    this.lastValues.set(entityKey, currentValue);
    this.lastTriggerTimes.set(entityKey, timestamp);
    
    // Set a new timer to allow the same value again after the distinct time
    const timer = setTimeout(() => {
      // After the distinct time, we can allow the same value again
      // The timer will be cleared when a new value comes in
    }, 1000); // Minimal timer, just for cleanup purposes
    
    this.distinctTimers.set(entityKey, timer);
  }

  /**
   * Manually reset the distinct tracking for a specific entity
   * @param entityKey - The key that identifies the entity
   */
  public reset(entityKey: string): void {
    this.clearDistinctTimer(entityKey);
    this.lastValues.delete(entityKey);
    this.lastTriggerTimes.delete(entityKey);
  }

  /**
   * Reset all distinct tracking and clear all entities
   */
  public resetAll(): void {
    for (const [entityKey] of this.distinctTimers) {
      this.clearDistinctTimer(entityKey);
    }
    this.lastValues.clear();
    this.lastTriggerTimes.clear();
  }

  /**
   * Get the last value for a specific entity
   * @param entityKey - The key that identifies the entity
   * @returns The last value, or undefined if no value has been recorded
   */
  public getLastValue(entityKey: string): any {
    return this.lastValues.get(entityKey);
  }

  /**
   * Get the last trigger time for a specific entity
   * @param entityKey - The key that identifies the entity
   * @returns The last trigger time in milliseconds, or undefined if no trigger has been recorded
   */
  public getLastTriggerTime(entityKey: string): number | undefined {
    return this.lastTriggerTimes.get(entityKey);
  }

  /**
   * Get the number of entities currently being tracked
   * @returns The number of entities currently being tracked
   */
  public getEntityCount(): number {
    return this.lastValues.size;
  }

  /**
   * Clear the distinct timer for a specific entity
   * @param entityKey - The key that identifies the entity
   */
  private clearDistinctTimer(entityKey: string): void {
    const timer = this.distinctTimers.get(entityKey);
    if (timer) {
      clearTimeout(timer);
      this.distinctTimers.delete(entityKey);
    }
  }
}
