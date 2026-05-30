import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeSentry } from '../utils/sentry/init';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('[ERROR BOUNDARY] Caught error:', error);
        console.error('[ERROR BOUNDARY] Error info:', errorInfo);

        SafeSentry.captureException(error, {
            contexts: {
                react: {
                    componentStack: errorInfo.componentStack,
                },
            },
        });

        this.setState({ error, errorInfo });
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render(): ReactNode {
        if (!this.state.hasError) {
            return this.props.children;
        }

        const { error, errorInfo } = this.state;

        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.title}>Something went wrong</Text>
                    <Text style={styles.message}>
                        The app encountered an unexpected error. You can try restarting it.
                    </Text>

                    {__DEV__ && error && (
                        <ScrollView style={styles.errorContainer}>
                            <Text style={styles.errorTitle}>Error Details:</Text>
                            <Text style={styles.errorText}>{error.toString()}</Text>
                            {errorInfo?.componentStack && (
                                <Text style={styles.errorStack}>{errorInfo.componentStack}</Text>
                            )}
                        </ScrollView>
                    )}

                    <Pressable
                        style={styles.retryButton}
                        onPress={this.handleRetry}
                        accessibilityRole='button'
                        accessibilityLabel='Retry loading the app'
                        testID='error-retry-button'
                    >
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </Pressable>
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1A1B2E',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    content: {
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.75)',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 22,
    },
    errorContainer: {
        width: '100%',
        maxHeight: 200,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
    },
    errorTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 6,
    },
    errorText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: 8,
    },
    errorStack: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    retryButton: {
        backgroundColor: '#7C3AED',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 8,
        minWidth: 150,
        alignItems: 'center',
    },
    retryButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#FFFFFF',
    },
});
