import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('🚨 [ErrorBoundary] Caught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '8px', color: '#333' }}>
                    <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                        Something went wrong loading read receipts.
                    </div>
                    <details style={{ fontSize: '12px', color: '#666' }}>
                        <summary>Error details</summary>
                        <pre style={{ whiteSpace: 'pre-wrap' }}>
                            {this.state.error?.message}
                        </pre>
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}
