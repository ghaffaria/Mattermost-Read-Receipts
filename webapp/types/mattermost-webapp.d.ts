declare module 'mattermost-webapp/plugins/registry' {
  // Bare-minimum typings – Mattermost injects the real implementation at runtime
  export interface PluginRegistry {
    registerPostTypeComponent(component: (props: any) => JSX.Element): void;
    // add more signatures if you call them
  }
}
