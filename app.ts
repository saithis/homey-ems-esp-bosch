'use strict';

import Homey from 'homey';
import { EntityCooldown } from './lib/entity-cooldown';
import { EntityDistinct } from './lib/entity-distinct';

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
    
    // Create a shared instance of EntityDistinct for all flow executions
    const entityDistinct = new EntityDistinct();
    
    // Register the cooldown run listener
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
    
    // Register the distinct flow card using SDK v3 syntax
    const distinctCard = this.homey.flow.getActionCard('distinct-value-changes');
    
    // Register the distinct run listener
    distinctCard.registerRunListener(async (args: { distinctTime: number; entityKey: string; valueKey: string }, state: any) => {
      try {
        const { distinctTime, entityKey, valueKey } = args;
        
        // Convert seconds to milliseconds
        const distinctTimeMs = distinctTime * 1000;
        
        // Get the entity identifier from the flow tokens
        let entityIdentifier: string;
        
        if (typeof entityKey === 'string' && entityKey.startsWith('$')) {
          // It's a token reference, extract the actual value
          const tokenName = entityKey.substring(1); // Remove the $ prefix
          entityIdentifier = state[tokenName] || entityKey;
        } else {
          // It's a direct value
          entityIdentifier = entityKey;
        }
        
        // Get the value to check for distinctness
        let currentValue: any;
        
        if (typeof valueKey === 'string' && valueKey.startsWith('$')) {
          // It's a token reference, extract the actual value
          const tokenName = valueKey.substring(1); // Remove the $ prefix
          currentValue = state[tokenName] || valueKey;
        } else {
          // It's a direct value
          currentValue = valueKey;
        }
        
        // Ensure we have valid identifiers
        if (!entityIdentifier || entityIdentifier === '') {
          this.log('Warning: No entity identifier provided, using default');
          entityIdentifier = 'default';
        }
        
        if (currentValue === undefined || currentValue === '') {
          this.log('Warning: No value provided, using empty string');
          currentValue = '';
        }
        
        this.log(`Checking distinct for entity: ${entityIdentifier}, value: ${JSON.stringify(currentValue)}, distinct time: ${distinctTime}s`);
        
        // Check if this entity should be allowed to trigger
        const shouldTrigger = entityDistinct.shouldTrigger(entityIdentifier, currentValue, distinctTimeMs);
        
        if (shouldTrigger) {
          this.log(`Entity ${entityIdentifier} allowed to trigger (value is distinct or time has passed)`);
          return true;
        } else {
          this.log(`Entity ${entityIdentifier} blocked (same value, not enough time passed)`);
          return false;
        }
        
      } catch (error) {
        this.error('Error in DistinctValueChangesFlowCard:', error);
        return false;
      }
    });
  }

}
