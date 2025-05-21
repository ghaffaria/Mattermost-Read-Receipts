
// webapp/index.tsx

/// <reference path="./types/mattermost-webapp.d.ts" />


import Plugin from './index'; 

(window as any).registerPlugin('mattermost-readreceipts', new Plugin());
