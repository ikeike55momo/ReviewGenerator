/**
 * @file useErrorHandler.ts
 * @description エラーハンドリング用カスタムフック
 * コンポーネント内でのエラー処理を簡素化
 */

import { useCallback, useState } from 'react';

export interface ErrorState {
  error: Error | null;
  isError: boolean;
  errorId: string;
}

export interface ErrorHandlerOptions {
  onError?: (error: Error) => void;
  enableLogging?: boolean;
  retryAttempts?: number;
}

export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const { onError, enableLogging = true, retryAttempts = 3 } = options;
  
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isError: false,
    errorId: ''
  });
  
  const [retryCount, setRetryCount] = useState(0);

  const handleError = useCallback((error: Error) => {
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    setErrorState({
      error,
      isError: true,
      errorId
    });

    // ログ記録
    if (enableLogging) {
      console.error(`[${errorId}] Error caught:`, error);
    }

    // カスタムエラーハンドラー呼び出し
    if (onError) {
      onError(error);
    }
  }, [onError, enableLogging]);

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isError: false,
      errorId: ''
    });
    setRetryCount(0);
  }, []);

  const retry = useCallback(async (asyncFn: () => Promise<void> | void) => {
    if (retryCount >= retryAttempts) {
      handleError(new Error(`最大再試行回数（${retryAttempts}回）に達しました`));
      return;
    }

    try {
      setRetryCount(prev => prev + 1);
      await asyncFn();
      clearError();
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [retryCount, retryAttempts, handleError, clearError]);

  const wrapAsync = useCallback(<T extends any[], R>(
    asyncFn: (...args: T) => Promise<R>
  ) => {
    return async (...args: T): Promise<R | undefined> => {
      try {
        return await asyncFn(...args);
      } catch (error) {
        handleError(error instanceof Error ? error : new Error(String(error)));
        return undefined;
      }
    };
  }, [handleError]);

  const wrapSync = useCallback(<T extends any[], R>(
    syncFn: (...args: T) => R
  ) => {
    return (...args: T): R | undefined => {
      try {
        return syncFn(...args);
      } catch (error) {
        handleError(error instanceof Error ? error : new Error(String(error)));
        return undefined;
      }
    };
  }, [handleError]);

  return {
    ...errorState,
    handleError,
    clearError,
    retry,
    wrapAsync,
    wrapSync,
    retryCount,
    canRetry: retryCount < retryAttempts
  };
}

/**
 * API呼び出し専用のエラーハンドラー
 */
export function useAPIErrorHandler() {
  return useErrorHandler({
    onError: (error) => {
      // API エラーの場合の特別な処理
      if (error.message.includes('fetch')) {
        console.error('Network error detected:', error);
      } else if (error.message.includes('401')) {
        console.error('Authentication error:', error);
      } else if (error.message.includes('500')) {
        console.error('Server error:', error);
      }
    },
    enableLogging: true,
    retryAttempts: 3
  });
}

/**
 * レビュー生成専用のエラーハンドラー
 */
export function useReviewGenerationErrorHandler() {
  return useErrorHandler({
    onError: (error) => {
      console.error('Review generation error:', error);
      
      // レビュー生成エラーの分類
      if (error.message.includes('CSV')) {
        console.error('CSV関連エラー:', error);
      } else if (error.message.includes('API')) {
        console.error('Claude API関連エラー:', error);
      } else if (error.message.includes('Quality')) {
        console.error('品質チェック関連エラー:', error);
      }
    },
    enableLogging: true,
    retryAttempts: 2
  });
}