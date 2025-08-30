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
    const cooldownCard = this.homey.flow.getActionCard('cooldown-value-changes');
    
    // Create a shared instance of EntityCooldown for all flow executions
    const entityCooldown = new EntityCooldown();
    
    // Register the run listener
    cooldownCard.registerRunListener(async (args: { cooldownTime: number; entityKey: string }, state: any) => {
      try {
        const { cooldownTime, entityKey } = args;
        
        // Convert seconds to milliseconds
        const cooldownTimeMs = cooldownTime * 1000;
        
        // Get the entity identifier from the flow tokens
        // The entityKey should be a token name that contains the actual entity value
        let entityIdentifier: string;
        
        if (typeof entityKey === 'string' && entityKey.startsWith('$')) {
          // It's a token reference, extract the actual value
          const tokenName = entityKey.substring(1); // Remove the $ prefix
          entityIdentifier = state[tokenName] || entityKey;
        } else {
          // It's a direct value
          entityIdentifier = entityKey;
        }
        
        // Ensure we have a valid entity identifier
        if (!entityIdentifier || entityIdentifier === '') {
          this.log('Warning: No entity identifier provided, using default');
          entityIdentifier = 'default';
        }
        
        this.log(`Checking cooldown for entity: ${entityIdentifier}, cooldown time: ${cooldownTime}s`);
        
        // Check if this entity should be allowed to trigger
        const shouldTrigger = entityCooldown.shouldTrigger(entityIdentifier, cooldownTimeMs);
        
        if (shouldTrigger) {
          this.log(`Entity ${entityIdentifier} allowed to trigger (not in cooldown)`);
          return true;
        } else {
          this.log(`Entity ${entityIdentifier} blocked (in cooldown)`);
          return false;
        }
        
      } catch (error) {
        this.error('Error in CooldownValueChangesFlowCard:', error);
        return false;
      }
    });
  }

}
