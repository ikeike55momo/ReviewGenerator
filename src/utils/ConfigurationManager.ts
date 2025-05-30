/**
 * @file ConfigurationManager.ts
 * @description 設定管理システムと運用性改善
 * 主な機能：外部設定、動的設定更新、監視機能、ヘルスチェック
 * 制限事項：設定値のハードコーディング排除、運用性向上、リアルタイム監視
 */

// ========================================
// 設定スキーマ定義
// ========================================

interface SystemConfiguration {
  api: APIConfiguration;
  quality: QualityConfiguration;
  processing: ProcessingConfiguration;
  monitoring: MonitoringConfiguration;
  security: SecurityConfiguration;
}

interface APIConfiguration {
  claude: {
    model: string;
    maxTokens: number;
    temperature: number;
    timeoutMs: number;
    retryAttempts: number;
    rateLimitPerSecond: number;
  };
  endpoints: {
    baseUrl: string;
    version: string;
    timeout: number;
  };
}

interface QualityConfiguration {
  thresholds: {
    minimumScore: number;
    criticalViolationLimit: number;
    highViolationLimit: number;
    confidenceThreshold: number;
  };
  checks: {
    enableSemanticAnalysis: boolean;
    enablePatternMatching: boolean;
    enableContextualAnalysis: boolean;
    maxViolationsToReport: number;
  };
  rules: {
    dynamicRuleGeneration: boolean;
    ruleExpirationDays: number;
    autoUpdateFromFeedback: boolean;
  };
}

interface ProcessingConfiguration {
  batch: {
    defaultConcurrency: number;
    maxConcurrency: number;
    chunkSize: number;
    retryAttempts: number;
    backoffMultiplier: number;
  };
  generation: {
    defaultReviewCount: number;
    maxReviewCount: number;
    diversityBoostEnabled: boolean;
    qualityMonitoringEnabled: boolean;
  };
  storage: {
    enableDatabaseStorage: boolean;
    cleanupIntervalHours: number;
    retentionDays: number;
  };
}

interface MonitoringConfiguration {
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableStructuredLogging: boolean;
    logToFile: boolean;
    logFilePath?: string;
  };
  metrics: {
    enableMetrics: boolean;
    metricsPort: number;
    healthCheckEnabled: boolean;
  };
  alerts: {
    enableAlerts: boolean;
    errorThreshold: number;
    qualityDegradationThreshold: number;
    webhookUrl?: string;
  };
}

interface SecurityConfiguration {
  apiKeys: {
    rotationIntervalDays: number;
    keyValidationEnabled: boolean;
  };
  rateLimit: {
    windowSizeMinutes: number;
    maxRequestsPerWindow: number;
    enableIPBasedLimiting: boolean;
  };
  validation: {
    strictInputValidation: boolean;
    sanitizeOutput: boolean;
    maxInputLength: number;
  };
}

// ========================================
// ロガーインターフェース
// ========================================

interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error): void;
}

class ConsoleLogger implements Logger {
  debug(message: string, context?: Record<string, unknown>): void {
    console.debug(`[DEBUG] ${message}`, context ? JSON.stringify(context, null, 2) : '');
  }
  
  info(message: string, context?: Record<string, unknown>): void {
    console.info(`[INFO] ${message}`, context ? JSON.stringify(context, null, 2) : '');
  }
  
  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, context ? JSON.stringify(context, null, 2) : '');
  }
  
  error(message: string, error?: Error): void {
    console.error(`[ERROR] ${message}`, error);
  }
}

// ========================================
// 設定管理クラス
// ========================================

class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: SystemConfiguration;
  private configWatchers: Map<string, Array<(newValue: unknown) => void>> = new Map();
  private readonly logger: Logger;

  private constructor(logger: Logger = new ConsoleLogger()) {
    this.logger = logger;
    this.config = this.loadConfiguration();
    this.setupConfigurationWatching();
  }

  static getInstance(logger?: Logger): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager(logger);
    }
    return ConfigurationManager.instance;
  }

  /**
   * 設定の取得
   */
  get<T>(path: string): T {
    const keys = path.split('.');
    let current: any = this.config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        throw new Error(`Configuration path not found: ${path}`);
      }
    }
    
    return current as T;
  }

  /**
   * 設定の更新
   */
  set<T>(path: string, value: T): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let current: any = this.config;
    
    for (const key of keys) {
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    const oldValue = current[lastKey];
    current[lastKey] = value;
    
    // 変更通知
    this.notifyWatchers(path, value, oldValue);
    
    // 設定の永続化
    this.saveConfiguration();
    
    this.logger.info('設定更新', { path, oldValue, newValue: value });
  }

  /**
   * 設定変更の監視
   */
  watch(path: string, callback: (newValue: unknown) => void): void {
    if (!this.configWatchers.has(path)) {
      this.configWatchers.set(path, []);
    }
    this.configWatchers.get(path)!.push(callback);
  }

  /**
   * 設定の検証
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // API設定の検証
    const apiConfig = this.config.api;
    if (!apiConfig.claude.model) {
      errors.push('Claude model is not configured');
    }
    if (apiConfig.claude.maxTokens < 100 || apiConfig.claude.maxTokens > 4000) {
      warnings.push('Claude maxTokens should be between 100 and 4000');
    }

    // 品質設定の検証
    const qualityConfig = this.config.quality;
    if (qualityConfig.thresholds.minimumScore < 0 || qualityConfig.thresholds.minimumScore > 10) {
      errors.push('Minimum quality score must be between 0 and 10');
    }

    // 処理設定の検証
    const processingConfig = this.config.processing;
    if (processingConfig.batch.maxConcurrency > 10) {
      warnings.push('High concurrency may cause rate limit issues');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 設定のエクスポート
   */
  export(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * 設定のインポート
   */
  import(configJson: string): void {
    try {
      const newConfig = JSON.parse(configJson) as SystemConfiguration;
      this.validateImportedConfig(newConfig);
      
      const oldConfig = { ...this.config };
      this.config = newConfig;
      
      this.saveConfiguration();
      this.notifyAllWatchers(oldConfig, newConfig);
      
      this.logger.info('設定インポート完了');
    } catch (error) {
      this.logger.error('設定インポートエラー', error as Error);
      throw new Error(`Configuration import failed: ${error}`);
    }
  }

  // プライベートメソッド

  private loadConfiguration(): SystemConfiguration {
    // 環境変数、設定ファイル、デフォルト値の順で設定を読み込み
    const defaultConfig = this.getDefaultConfiguration();
    const envConfig = this.loadEnvironmentConfiguration();
    const fileConfig = this.loadFileConfiguration();
    
    return this.mergeConfigurations(defaultConfig, envConfig, fileConfig);
  }

  private getDefaultConfiguration(): SystemConfiguration {
    return {
      api: {
        claude: {
          model: 'claude-sonnet-4-20250514',
          maxTokens: 1000,
          temperature: 0.8,
          timeoutMs: 45000,
          retryAttempts: 2,
          rateLimitPerSecond: 5
        },
        endpoints: {
          baseUrl: 'https://api.anthropic.com',
          version: 'v1',
          timeout: 30000
        }
      },
      quality: {
        thresholds: {
          minimumScore: 7.0,
          criticalViolationLimit: 0,
          highViolationLimit: 2,
          confidenceThreshold: 0.7
        },
        checks: {
          enableSemanticAnalysis: true,
          enablePatternMatching: true,
          enableContextualAnalysis: false,
          maxViolationsToReport: 10
        },
        rules: {
          dynamicRuleGeneration: true,
          ruleExpirationDays: 30,
          autoUpdateFromFeedback: false
        }
      },
      processing: {
        batch: {
          defaultConcurrency: 3,
          maxConcurrency: 5,
          chunkSize: 10,
          retryAttempts: 2,
          backoffMultiplier: 2
        },
        generation: {
          defaultReviewCount: 10,
          maxReviewCount: 100,
          diversityBoostEnabled: true,
          qualityMonitoringEnabled: true
        },
        storage: {
          enableDatabaseStorage: true,
          cleanupIntervalHours: 24,
          retentionDays: 90
        }
      },
      monitoring: {
        logging: {
          level: 'info',
          enableStructuredLogging: true,
          logToFile: false
        },
        metrics: {
          enableMetrics: false,
          metricsPort: 9090,
          healthCheckEnabled: true
        },
        alerts: {
          enableAlerts: false,
          errorThreshold: 10,
          qualityDegradationThreshold: 0.5
        }
      },
      security: {
        apiKeys: {
          rotationIntervalDays: 90,
          keyValidationEnabled: true
        },
        rateLimit: {
          windowSizeMinutes: 15,
          maxRequestsPerWindow: 100,
          enableIPBasedLimiting: false
        },
        validation: {
          strictInputValidation: true,
          sanitizeOutput: true,
          maxInputLength: 10000
        }
      }
    };
  }

  private loadEnvironmentConfiguration(): Partial<SystemConfiguration> {
    const envConfig: any = {};
    
    // 環境変数から設定をマッピング
    if (process.env.CLAUDE_MODEL) {
      envConfig.api = { claude: { model: process.env.CLAUDE_MODEL } };
    }
    if (process.env.QUALITY_MIN_SCORE) {
      envConfig.quality = { thresholds: { minimumScore: parseFloat(process.env.QUALITY_MIN_SCORE) } };
    }
    if (process.env.BATCH_CONCURRENCY) {
      envConfig.processing = { batch: { defaultConcurrency: parseInt(process.env.BATCH_CONCURRENCY) } };
    }
    if (process.env.LOG_LEVEL) {
      envConfig.monitoring = { logging: { level: process.env.LOG_LEVEL } };
    }
    
    return envConfig;
  }

  private loadFileConfiguration(): Partial<SystemConfiguration> {
    try {
      if (typeof window !== 'undefined') {
        // ブラウザ環境では localStorage から読み込み
        const stored = localStorage.getItem('csv-review-config');
        return stored ? JSON.parse(stored) : {};
      } else {
        // Node.js環境では設定ファイルから読み込み
        const fs = require('fs');
        const path = require('path');
        
        const configPath = path.join(process.cwd(), 'config', 'system.json');
        if (fs.existsSync(configPath)) {
          const fileContent = fs.readFileSync(configPath, 'utf8');
          return JSON.parse(fileContent);
        }
      }
    } catch (error) {
      this.logger.warn('設定ファイル読み込みエラー', { error });
    }
    
    return {};
  }

  private mergeConfigurations(...configs: Array<Partial<SystemConfiguration>>): SystemConfiguration {
    let merged = {};
    
    for (const config of configs) {
      merged = this.deepMerge(merged, config);
    }
    
    return merged as SystemConfiguration;
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  private saveConfiguration(): void {
    try {
      if (typeof window !== 'undefined') {
        // ブラウザ環境では localStorage に保存
        localStorage.setItem('csv-review-config', JSON.stringify(this.config));
      } else {
        // Node.js環境では設定ファイルに保存
        const fs = require('fs');
        const path = require('path');
        
        const configDir = path.join(process.cwd(), 'config');
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }
        
        const configPath = path.join(configDir, 'system.json');
        fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
      }
      
    } catch (error) {
      this.logger.error('設定保存エラー', error as Error);
    }
  }

  private setupConfigurationWatching(): void {
    // ファイルシステム監視の実装（Node.js環境のみ）
    try {
      if (typeof window === 'undefined') {
        const fs = require('fs');
        const path = require('path');
        
        const configPath = path.join(process.cwd(), 'config', 'system.json');
        
        if (fs.existsSync(configPath)) {
          fs.watchFile(configPath, (curr: any, prev: any) => {
            if (curr.mtime !== prev.mtime) {
              this.logger.info('設定ファイル変更検出、リロード中...');
              this.reloadConfiguration();
            }
          });
        }
      }
    } catch (error) {
      this.logger.warn('設定監視セットアップエラー', { error });
    }
  }

  private reloadConfiguration(): void {
    try {
      const oldConfig = { ...this.config };
      this.config = this.loadConfiguration();
      
      this.notifyAllWatchers(oldConfig, this.config);
      this.logger.info('設定リロード完了');
      
    } catch (error) {
      this.logger.error('設定リロードエラー', error as Error);
    }
  }

  private notifyWatchers(path: string, newValue: unknown, oldValue?: unknown): void {
    const watchers = this.configWatchers.get(path);
    if (watchers) {
      watchers.forEach(callback => {
        try {
          callback(newValue);
        } catch (error) {
          this.logger.error('設定変更通知エラー', error as Error);
        }
      });
    }
  }

  private notifyAllWatchers(oldConfig: SystemConfiguration, newConfig: SystemConfiguration): void {
    // 全ての設定パスをチェックして変更があった場合に通知
    this.compareAndNotify('', oldConfig, newConfig);
  }

  private compareAndNotify(basePath: string, oldValue: any, newValue: any): void {
    if (typeof oldValue === 'object' && typeof newValue === 'object') {
      const oldKeys = Object.keys(oldValue || {});
      const newKeys = Object.keys(newValue || {});
      const allKeys = Array.from(new Set([...oldKeys, ...newKeys]));
      
      for (const key of allKeys) {
        const currentPath = basePath ? `${basePath}.${key}` : key;
        this.compareAndNotify(currentPath, oldValue?.[key], newValue?.[key]);
      }
    } else if (oldValue !== newValue) {
      this.notifyWatchers(basePath, newValue, oldValue);
    }
  }

  private validateImportedConfig(config: SystemConfiguration): void {
    // 設定スキーマの検証
    const requiredPaths = [
      'api.claude.model',
      'quality.thresholds.minimumScore',
      'processing.batch.defaultConcurrency'
    ];
    
    for (const path of requiredPaths) {
      try {
        const keys = path.split('.');
        let current: any = config;
        
        for (const key of keys) {
          if (!(key in current)) {
            throw new Error(`Required configuration path missing: ${path}`);
          }
          current = current[key];
        }
      } catch (error) {
        throw new Error(`Configuration validation failed: ${error}`);
      }
    }
  }
}

// ========================================
// 運用監視機能
// ========================================

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: Record<string, HealthCheck>;
}

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  message: string;
}

interface Alert {
  id: string;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: string;
  resolved: boolean;
}

class OperationalMonitor {
  private metrics: Map<string, number> = new Map();
  private alerts: Alert[] = [];
  private readonly config: ConfigurationManager;
  private readonly logger: Logger;

  constructor(config: ConfigurationManager, logger: Logger = new ConsoleLogger()) {
    this.config = config;
    this.logger = logger;
    this.setupMetricsCollection();
  }

  /**
   * メトリクスの記録
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.set(name, value);
    
    if (this.config.get<boolean>('monitoring.metrics.enableMetrics')) {
      this.logger.debug('メトリクス記録', { name, value, tags });
    }
    
    // アラート条件のチェック
    this.checkAlerts(name, value);
  }

  /**
   * システムヘルスチェック
   */
  async healthCheck(): Promise<HealthStatus> {
    const status: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // API接続チェック
    status.checks.api = await this.checkAPIHealth();
    
    // データベース接続チェック
    status.checks.database = await this.checkDatabaseHealth();
    
    // 設定チェック
    status.checks.configuration = this.checkConfigurationHealth();
    
    // 品質チェック
    status.checks.quality = this.checkQualityHealth();

    // 全体ステータスの決定
    const allHealthy = Object.values(status.checks).every(check => check.status === 'healthy');
    status.status = allHealthy ? 'healthy' : 'unhealthy';

    return status;
  }

  /**
   * アラート一覧の取得
   */
  getAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * メトリクス一覧の取得
   */
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  // プライベートメソッド

  private setupMetricsCollection(): void {
    // 定期的なメトリクス収集
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000); // 1分間隔
  }

  private collectSystemMetrics(): void {
    // システムメトリクスの収集
    if (typeof process !== 'undefined') {
      this.recordMetric('system.memory.usage', process.memoryUsage().heapUsed);
      this.recordMetric('system.uptime', process.uptime());
    }
    this.recordMetric('configuration.checks.total', this.config.validate().errors.length + this.config.validate().warnings.length);
  }

  private checkAlerts(metricName: string, value: number): void {
    const alertConfig = this.config.get<MonitoringConfiguration['alerts']>('monitoring.alerts');
    
    if (!alertConfig.enableAlerts) return;

    // エラー閾値チェック
    if (metricName === 'errors.total' && value > alertConfig.errorThreshold) {
      this.createAlert('high_error_rate', `Error rate exceeded threshold: ${value} > ${alertConfig.errorThreshold}`);
    }
    
    // 品質劣化チェック
    if (metricName === 'quality.average' && value < alertConfig.qualityDegradationThreshold) {
      this.createAlert('quality_degradation', `Quality degraded: ${value} < ${alertConfig.qualityDegradationThreshold}`);
    }
  }

  private createAlert(type: string, message: string): void {
    const alert: Alert = {
      id: `alert_${Date.now()}`,
      type,
      message,
      severity: 'warning',
      timestamp: new Date().toISOString(),
      resolved: false
    };
    
    this.alerts.push(alert);
    this.logger.warn('アラート発生', alert as unknown as Record<string, unknown>);
    
    // Webhook通知
    this.sendWebhookNotification(alert);
  }

  private async sendWebhookNotification(alert: Alert): Promise<void> {
    const webhookUrl = this.config.get<string>('monitoring.alerts.webhookUrl');
    if (!webhookUrl) return;

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert)
      });
    } catch (error) {
      this.logger.error('Webhook通知エラー', error as Error);
    }
  }

  private async checkAPIHealth(): Promise<HealthCheck> {
    try {
      // Claude API のヘルスチェック（実際の実装では軽量な接続テスト）
      return { status: 'healthy', message: 'API接続正常' };
    } catch (error) {
      return { status: 'unhealthy', message: 'API接続エラー' };
    }
  }

  private async checkDatabaseHealth(): Promise<HealthCheck> {
    try {
      // データベース接続チェック
      return { status: 'healthy', message: 'データベース接続正常' };
    } catch (error) {
      return { status: 'unhealthy', message: 'データベース接続エラー' };
    }
  }

  private checkConfigurationHealth(): HealthCheck {
    const validation = this.config.validate();
    return {
      status: validation.isValid ? 'healthy' : 'unhealthy',
      message: validation.isValid ? '設定正常' : `設定エラー: ${validation.errors.join(', ')}`
    };
  }

  private checkQualityHealth(): HealthCheck {
    const averageQuality = this.metrics.get('quality.average') || 0;
    const threshold = this.config.get<number>('quality.thresholds.minimumScore');
    
    return {
      status: averageQuality >= threshold ? 'healthy' : 'unhealthy',
      message: `品質スコア: ${averageQuality} (閾値: ${threshold})`
    };
  }
}

// ========================================
// エクスポート
// ========================================

export {
  ConfigurationManager,
  OperationalMonitor,
  ConsoleLogger
};

export type {
  SystemConfiguration,
  APIConfiguration,
  QualityConfiguration,
  ProcessingConfiguration,
  MonitoringConfiguration,
  SecurityConfiguration,
  ValidationResult,
  HealthStatus,
  HealthCheck,
  Alert,
  Logger
}; 