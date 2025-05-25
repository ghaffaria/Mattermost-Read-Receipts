// webapp/types/mattermost-webapp.d.ts

declare module 'mattermost-webapp/plugins/registry' {
    // Bare-minimum typings – Mattermost injects the real implementation at runtime
    export interface PluginRegistry {
        registerPostTypeComponent(component: (props: any) => JSX.Element): void;
        registerReducer(reducer: Record<string, any>): void;
        registerRootComponent(component: React.ComponentType<any>): void;
        registerWebSocketEventHandler(
            eventName: string,
            handler: (event: MessageEvent) => void
        ): void;
    }
}

declare global {
    interface Window {
        registerPlugin: (id: string, plugin: any) => void;
    }
}

declare module 'mattermost-webapp/plugins/registry' {
    export interface PluginRegistry {
        registerPostTypeComponent(typeName: string, component: React.ComponentType<any>): void;
        // Add other registry methods as needed
    }
}

export interface Post {
    id: string;
    type?: string;
    user_id: string;
}

// Extend window interface for Mattermost globals
declare global {
    interface Window {
        registerPlugin: (id: string, plugin: any) => void;
    }
}


