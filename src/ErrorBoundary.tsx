import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({
            error,
            errorInfo
        });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                    <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-red-100">
                        <div className="p-6 bg-red-50 border-b border-red-100 flex items-center gap-3">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                            <h2 className="text-2xl font-bold text-red-800">Something went wrong</h2>
                        </div>

                        <div className="p-6 overflow-auto max-h-[60vh]">
                            <p className="text-gray-700 font-medium mb-4">
                                The application encountered an unexpected error.
                            </p>

                            {this.state.error && (
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-gray-900 mb-1">Error Message:</h3>
                                    <pre className="bg-red-50 text-red-700 p-3 rounded-lg text-sm overflow-x-auto border border-red-100 whitespace-pre-wrap">
                                        {this.state.error.toString()}
                                    </pre>
                                </div>
                            )}

                            {this.state.errorInfo && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 mb-1">Component Stack:</h3>
                                    <pre className="bg-gray-100 text-gray-600 p-3 rounded-lg text-xs overflow-x-auto border border-gray-200">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => window.location.reload()}
                                className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-red-700 transition-colors shadow-sm"
                            >
                                <RefreshCcw className="w-4 h-4" />
                                Reload Application
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
