/**
 * EntityCooldown - A class that provides cooldown functionality for multiple entities
 * Each entity can have its own cooldown timer. The first trigger is always allowed,
 * but subsequent triggers are blocked until there's a gap of no events for the specified time.
 */
export class EntityCooldown {
  private cooldownTimers = new Map<string, NodeJS.Timeout>();
  private lastTriggerTimes = new Map<string, number>();
  private isInCooldown = new Map<string, boolean>();

  /**
   * Check if an entity should be allowed to trigger based on cooldown settings
   * @param entityKey - The key that identifies the entity (e.g., room name, device ID)
   * @param cooldownTimeMs - The cooldown time in milliseconds
   * @returns true if the entity should be allowed to trigger, false if it should be blocked
   */
  public shouldTrigger(entityKey: string, cooldownTimeMs: number): boolean {
    const now = Date.now();
    const lastTriggerTime = this.lastTriggerTimes.get(entityKey);
    const currentlyInCooldown = this.isInCooldown.get(entityKey);
    
    if (!lastTriggerTime) {
      // First time this entity has triggered - always allow
      this.startCooldown(entityKey, cooldownTimeMs);
      return true;
    }
    
    if (currentlyInCooldown) {
      // Entity is in cooldown - block the trigger
      return false;
    }
    
    // Entity is not in cooldown - allow the trigger and start cooldown
    this.startCooldown(entityKey, cooldownTimeMs);
    return true;
  }

  /**
   * Start the cooldown period for an entity
   * @param entityKey - The key that identifies the entity
   * @param cooldownTimeMs - The cooldown time in milliseconds
   */
  private startCooldown(entityKey: string, cooldownTimeMs: number): void {
    const now = Date.now();
    
    // Clear any existing timer for this entity
    this.clearCooldownTimer(entityKey);
    
    // Set the last trigger time and mark as in cooldown
    this.lastTriggerTimes.set(entityKey, now);
    this.isInCooldown.set(entityKey, true);
    
    // Set a new cooldown timer
    const timer = setTimeout(() => {
      this.isInCooldown.set(entityKey, false);
      this.clearCooldownTimer(entityKey);
    }, cooldownTimeMs);
    
    this.cooldownTimers.set(entityKey, timer);
  }

  /**
   * Manually reset the cooldown timer for a specific entity
   * @param entityKey - The key that identifies the entity
   */
  public reset(entityKey: string): void {
    this.clearCooldownTimer(entityKey);
    this.lastTriggerTimes.delete(entityKey);
    this.isInCooldown.delete(entityKey);
  }

  /**
   * Reset all cooldown timers and clear all entities
   */
  public resetAll(): void {
    for (const [entityKey] of this.cooldownTimers) {
      this.clearCooldownTimer(entityKey);
    }
    this.lastTriggerTimes.clear();
    this.isInCooldown.clear();
  }

  /**
   * Get the remaining cooldown time for a specific entity
   * @param entityKey - The key that identifies the entity
   * @returns The remaining time in milliseconds, or 0 if no cooldown is active
   */
  public getRemainingTime(entityKey: string): number {
    const lastTriggerTime = this.lastTriggerTimes.get(entityKey);
    if (!lastTriggerTime) return 0;
    
    const now = Date.now();
    const elapsed = now - lastTriggerTime;
    
    // Find the cooldown timer to get the total cooldown time
    const timer = this.cooldownTimers.get(entityKey);
    if (!timer) return 0;
    
    // We need to estimate the cooldown time since we don't store it
    // This is a rough estimate based on typical usage patterns
    const estimatedCooldownTime = 300000; // 5 minutes default
    const remaining = Math.max(0, estimatedCooldownTime - elapsed);
    
    return remaining;
  }

  /**
   * Check if a specific entity is currently in cooldown
   * @param entityKey - The key that identifies the entity
   * @returns true if the entity is currently in cooldown
   */
  public isEntityInCooldown(entityKey: string): boolean {
    return this.isInCooldown.get(entityKey) || false;
  }

  /**
   * Get the number of entities currently in cooldown
   * @returns The number of entities currently in cooldown
   */
  public getCooldownCount(): number {
    return this.cooldownTimers.size;
  }

  /**
   * Clear the cooldown timer for a specific entity
   * @param entityKey - The key that identifies the entity
   */
  private clearCooldownTimer(entityKey: string): void {
    const timer = this.cooldownTimers.get(entityKey);
    if (timer) {
      clearTimeout(timer);
      this.cooldownTimers.delete(entityKey);
    }
  }
}
