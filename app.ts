'use strict';

import Homey from 'homey';
import { EntityCooldown } from './lib/entity-cooldown';

module.exports = class MyApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('App EMS-ESP has been initialized');
    
    // Register the cooldown flow card using SDK v3 syntax
    const cooldownCard = this.homey.flow.getConditionCard('cooldown-condition-flow');
    
    // Create a shared instance of EntityCooldown for all flow executions
    const entityCooldown = new EntityCooldown();
    
    // Register the cooldown run listener
    cooldownCard.registerRunListener(async (args: { cooldownTime: number; partitionKey: string }, state: any) => {
      try {
        const { cooldownTime, partitionKey } = args;

        //this.log('Debug: Cooldown flow triggered with args:', args, 'and state:', state);
        
        // Convert seconds to milliseconds
        const cooldownTimeMs = cooldownTime * 1000;
        
        this.log(`Checking cooldown for partition: ${partitionKey}, cooldown time: ${cooldownTime}s`);
        
        // Check if this entity should be allowed to trigger
        if (entityCooldown.shouldTrigger(partitionKey, cooldownTimeMs)) {
          this.log(`Partition ${partitionKey} allowed to trigger (not in cooldown)`);
          return true;
        } else {
          this.log(`Partition ${partitionKey} blocked (in cooldown)`);
          return false;
        }
        
      } catch (error) {
        this.error('Error in cooldown-condition-flow:', error);
        return false;
      }
    });
  }

}
