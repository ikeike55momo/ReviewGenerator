/**
 * @file withErrorBoundary.tsx
 * @description Higher-Order Component (HOC) for wrapping components with error boundaries
 * 任意のコンポーネントを簡単にエラーバウンダリでラップ
 */

import React, { ComponentType, ReactNode } from 'react';
import ErrorBoundary, { 
  APIErrorBoundary, 
  ReviewGenerationErrorBoundary 
} from './ErrorBoundary';

export interface ErrorBoundaryConfig {
  type?: 'default' | 'api' | 'review';
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * デフォルトのエラーバウンダリでコンポーネントをラップ
 */
export function withErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  config: ErrorBoundaryConfig = {}
) {
  const { type = 'default', fallback, onError } = config;

  const WrappedComponent = (props: P) => {
    const ErrorBoundaryComponent = 
      type === 'api' ? APIErrorBoundary :
      type === 'review' ? ReviewGenerationErrorBoundary :
      ErrorBoundary;

    return (
      <ErrorBoundaryComponent fallback={fallback} onError={onError}>
        <Component {...props} />
      </ErrorBoundaryComponent>
    );
  };

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * API関連のコンポーネント用
 */
export function withAPIErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
) {
  return withErrorBoundary(Component, { type: 'api', fallback, onError });
}

/**
 * レビュー生成関連のコンポーネント用
 */
export function withReviewErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
) {
  return withErrorBoundary(Component, { type: 'review', fallback, onError });
}

/**
 * 複数のエラーバウンダリを階層化してラップ
 */
export function withMultipleErrorBoundaries<P extends object>(
  Component: ComponentType<P>,
  configs: ErrorBoundaryConfig[]
) {
  return configs.reduceRight((WrappedComponent, config) => {
    return withErrorBoundary(WrappedComponent, config);
  }, Component);
}

export default withErrorBoundary;