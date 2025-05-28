/**
 * データベースコネクションプール設定
 * 
 * 概要:
 * - Supabaseデータベースへの効率的な接続管理
 * - コネクションプールによるパフォーマンス最適化
 * - リトライ機能付きエラーハンドリング
 * 
 * 主な機能:
 * - コネクションプールの作成・管理
 * - 自動リトライ機能
 * - コネクション監視・ヘルスチェック
 * - リソースの自動開放
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './supabase';

/**
 * コネクションプール設定インターフェース
 */
export interface ConnectionPoolConfig {
  // 基本設定
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  
  // プール設定
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;
  
  // リトライ設定
  maxRetries: number;
  retryDelayMs: number;
  
  // ヘルスチェック設定
  healthCheckIntervalMs: number;
  connectionTestQuery: string;
}

/**
 * コネクション統計情報
 */
export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  lastHealthCheck: Date;
  isHealthy: boolean;
}

/**
 * データベースコネクションプールクラス
 */
export class DatabaseConnectionPool {
  private config: ConnectionPoolConfig;
  private pool: SupabaseClient[] = [];
  private activeConnections: Set<SupabaseClient> = new Set();
  private waitingQueue: Array<{
    resolve: (client: SupabaseClient) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private healthCheckInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(config: ConnectionPoolConfig) {
    this.config = config;
    this.initializePool();
    this.startHealthCheck();
  }

  /**
   * プールの初期化
   */
  private initializePool(): void {
    for (let i = 0; i < this.config.minConnections; i++) {
      const client = this.createClient();
      this.pool.push(client);
    }
  }

  /**
   * Supabaseクライアントの作成
   */
  private createClient(): SupabaseClient<Database> {
    const key = this.config.serviceRoleKey || this.config.anonKey;
    return createClient<Database>(this.config.url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'X-Client-Info': 'csv-review-generator-pool',
        },
      },
      // コネクションプール設定
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }

  /**
   * コネクションの取得（プールから）
   */
  public async acquire(): Promise<SupabaseClient<Database>> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    // アイドルコネクションがある場合はそれを使用
    if (this.pool.length > 0) {
      const client = this.pool.pop()!;
      this.activeConnections.add(client);
      return client;
    }

    // 最大コネクション数に達していない場合は新しいコネクションを作成
    if (this.getTotalConnections() < this.config.maxConnections) {
      const client = this.createClient();
      this.activeConnections.add(client);
      return client;
    }

    // コネクションを待機
    return this.waitForConnection();
  }

  /**
   * コネクションの待機（キューイング）
   */
  private waitForConnection(): Promise<SupabaseClient<Database>> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error(`Connection acquire timeout after ${this.config.acquireTimeoutMillis}ms`));
      }, this.config.acquireTimeoutMillis);

      this.waitingQueue.push({
        resolve: (client: SupabaseClient<Database>) => {
          clearTimeout(timeoutId);
          resolve(client);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        timestamp: Date.now(),
      });
    });
  }

  /**
   * コネクションの解放（プールに戻す）
   */
  public release(client: SupabaseClient<Database>): void {
    if (!this.activeConnections.has(client)) {
      console.warn('Attempting to release a connection that is not in active use');
      return;
    }

    this.activeConnections.delete(client);

    // 待機中のリクエストがある場合は優先的に処理
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift()!;
      this.activeConnections.add(client);
      waiter.resolve(client);
      return;
    }

    // プールサイズが最小値を超えている場合はコネクションを破棄
    if (this.pool.length >= this.config.minConnections) {
      // コネクションを破棄（Supabaseの場合は特別な処理は不要）
      return;
    }

    // プールに戻す
    this.pool.push(client);
  }

  /**
   * リトライ機能付きクエリ実行
   */
  public async executeWithRetry<T>(
    operation: (client: SupabaseClient<Database>) => Promise<T>
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      const client = await this.acquire();
      
      try {
        const result = await operation(client);
        this.release(client);
        return result;
      } catch (error) {
        this.release(client);
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }
    
    throw lastError!;
  }

  /**
   * ヘルスチェックの開始
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * ヘルスチェックの実行
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const client = await this.acquire();
      
      try {
        const { data, error } = await client
          .from('system_settings')
          .select('setting_key')
          .limit(1);
        
        if (error) {
          console.warn('Health check failed:', error.message);
        }
      } finally {
        this.release(client);
      }
    } catch (error) {
      console.error('Health check error:', error);
    }
  }

  /**
   * 統計情報の取得
   */
  public getStats(): ConnectionStats {
    return {
      totalConnections: this.getTotalConnections(),
      activeConnections: this.activeConnections.size,
      idleConnections: this.pool.length,
      waitingRequests: this.waitingQueue.length,
      lastHealthCheck: new Date(),
      isHealthy: this.pool.length > 0 || this.activeConnections.size > 0,
    };
  }

  /**
   * 総コネクション数の取得
   */
  private getTotalConnections(): number {
    return this.pool.length + this.activeConnections.size;
  }

  /**
   * プールのシャットダウン
   */
  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // 待機中のリクエストを拒否
    while (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift()!;
      waiter.reject(new Error('Connection pool is shutting down'));
    }

    // アクティブなコネクションが解放されるまで待機
    const maxWaitTime = 30000; // 30秒
    const startTime = Date.now();
    
    while (this.activeConnections.size > 0 && Date.now() - startTime < maxWaitTime) {
      await this.delay(100);
    }

    // 残りのコネクションを強制的に破棄
    this.pool.length = 0;
    this.activeConnections.clear();
  }

  /**
   * 遅延ユーティリティ
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * デフォルト設定
 */
const getDefaultConfig = (): Omit<ConnectionPoolConfig, 'url' | 'anonKey'> => ({
  maxConnections: 20,
  minConnections: 2,
  acquireTimeoutMillis: 30000,
  idleTimeoutMillis: 300000, // 5分
  maxRetries: 3,
  retryDelayMs: 1000,
  healthCheckIntervalMs: 60000, // 1分
  connectionTestQuery: 'SELECT 1',
});

/**
 * グローバルコネクションプールインスタンス
 */
let globalPool: DatabaseConnectionPool | null = null;

/**
 * コネクションプールの取得または作成
 */
export function getConnectionPool(): DatabaseConnectionPool {
  if (!globalPool) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey) {
      throw new Error('Missing required environment variables for Supabase connection');
    }

    const config: ConnectionPoolConfig = {
      url,
      anonKey,
      serviceRoleKey,
      ...getDefaultConfig(),
    };

    globalPool = new DatabaseConnectionPool(config);
  }

  return globalPool;
}

/**
 * コネクションプールの統計情報を取得するヘルパー
 */
export function getPoolStats(): ConnectionStats {
  return getConnectionPool().getStats();
}

/**
 * アプリケーション終了時のクリーンアップ
 */
export async function shutdownPool(): Promise<void> {
  if (globalPool) {
    await globalPool.shutdown();
    globalPool = null;
  }
}

// プロセス終了時の自動クリーンアップ
if (typeof process !== 'undefined') {
  process.on('SIGINT', shutdownPool);
  process.on('SIGTERM', shutdownPool);
  process.on('beforeExit', shutdownPool);
}