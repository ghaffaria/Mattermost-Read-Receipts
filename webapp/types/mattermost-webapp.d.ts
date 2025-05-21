// webapp/types/mattermost-webapp.d.ts

declare module 'mattermost-webapp/plugins/registry' {
  // Bare-minimum typings – Mattermost injects the real implementation at runtime
  export interface PluginRegistry {
    registerPostTypeComponent(component: (props: any) => JSX.Element): void;
    // add more signatures if you call them
  }
}

declare module 'mattermost-webapp/plugins/registry' {
    interface PluginRegistry {
        registerWebSocketEventHandler: (
            eventName: string,
            handler: (event: MessageEvent) => void
        ) => void;
    }
}

declare global {
    interface Window {
        registerPlugin: (id: string, plugin: any) => void;
    }
}
