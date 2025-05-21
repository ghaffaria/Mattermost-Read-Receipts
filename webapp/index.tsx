// webapp/index.tsx

/// <reference path="./types/mattermost-webapp.d.ts" />


import Plugin from './index'; 

try {
    (window as any).registerPlugin('mattermost-readreceipts', new Plugin());
    console.log('✅ Plugin registered successfully.');
} catch (error) {
    console.error('❌ Failed to register plugin:', error);
}
