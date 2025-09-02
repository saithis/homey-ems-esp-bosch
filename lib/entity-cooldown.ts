/**
 * EntityCooldown - A class that provides cooldown functionality for multiple entities
 * Each entity can have its own cooldown timer. The first trigger is always allowed,
 * but subsequent triggers are blocked until there's a gap of no events for the specified time.
 */
export class EntityCooldown {
  private cleanupTimer?: NodeJS.Timeout;
  private activeCooldowns = new Map<string, {startTime: number, cooldownTimeMs: number}>();

  /**
   * Check if a partition should be allowed to trigger based on cooldown settings
   * @param partitionKey - The key that identifies the partition (e.g., room name, device ID)
   * @param cooldownTimeMs - The cooldown time in milliseconds
   * @returns true if the partition should be allowed to trigger, false if it should be blocked
   */
  public shouldTrigger(partitionKey: string, cooldownTimeMs: number): boolean {
    const now = Date.now();
    const cooldown = this.activeCooldowns.get(partitionKey);
    
    if (!cooldown || cooldown.startTime + cooldownTimeMs < now) {
      this.startCooldown(partitionKey, cooldownTimeMs);
      return true;
    } else if(cooldown.cooldownTimeMs != cooldownTimeMs) {
      cooldown.cooldownTimeMs = cooldownTimeMs;
    }
    
    return false;
  }

  /**
   * Start the cooldown period for a partition
   * @param partitionKey - The key that identifies the partition
   * @param cooldownTimeMs - The cooldown time in milliseconds
   */
  private startCooldown(partitionKey: string, cooldownTimeMs: number): void {
    const now = Date.now();
    
    // Set the last trigger time and mark as in cooldown
    this.activeCooldowns.set(partitionKey, {startTime: now, cooldownTimeMs: cooldownTimeMs});
    
    if(!this.cleanupTimer){
      this.cleanupTimer = setTimeout(() => {
        for (const [entityKey, cooldown] of this.activeCooldowns) {
          if(cooldown.startTime + cooldown.cooldownTimeMs < now) {
            this.activeCooldowns.delete(entityKey);
          }
        }
        this.cleanupTimer = undefined;
      }, 30000); // 30 seconds
    }
  }
}
