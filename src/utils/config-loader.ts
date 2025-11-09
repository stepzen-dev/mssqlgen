import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import * as dotenv from 'dotenv';
import { Config, DatabaseConfig, GenerationConfig } from '../types';

export class ConfigLoader {
  /**
   * Loads configuration from environment variables
   */
  static loadFromEnv(): Config {
    dotenv.config();

    const database: DatabaseConfig = {
      server: process.env.DB_SERVER || 'localhost',
      database: process.env.DB_DATABASE || '',
      user: process.env.DB_USER || '',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 1433,
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
      },
    };

    const generation: GenerationConfig = {
      outputDir: process.env.OUTPUT_DIR || './stepzen',
      features: {
        generateMutations: process.env.GENERATE_MUTATIONS === 'true',
        generateRelationships: process.env.GENERATE_RELATIONSHIPS === 'true',
      },
    };

    return { database, generation };
  }

  /**
   * Loads configuration from a YAML file
   */
  static loadFromFile(filePath: string): Config {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Configuration file not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const config = yaml.parse(fileContent);

    // Replace environment variable placeholders
    this.replaceEnvVariables(config);

    return config as Config;
  }

  /**
   * Loads configuration from file if it exists, otherwise from environment
   */
  static load(configPath?: string): Config {
    if (configPath) {
      return this.loadFromFile(configPath);
    }

    // Try to find config file in current directory
    const defaultPaths = [
      'mssqlgen.config.yaml',
      'mssqlgen.config.yml',
      '.mssqlgenrc.yaml',
      '.mssqlgenrc.yml',
    ];

    for (const defaultPath of defaultPaths) {
      if (fs.existsSync(defaultPath)) {
        console.log(`Using configuration file: ${defaultPath}`);
        return this.loadFromFile(defaultPath);
      }
    }

    // Fall back to environment variables
    console.log('Using configuration from environment variables');
    return this.loadFromEnv();
  }

  /**
   * Validates the configuration
   */
  static validate(config: Config): void {
    if (!config.database.server) {
      throw new Error('Database server is required');
    }
    if (!config.database.database) {
      throw new Error('Database name is required');
    }
    if (!config.database.user) {
      throw new Error('Database user is required');
    }
    if (!config.database.password) {
      throw new Error('Database password is required');
    }
  }

  /**
   * Replaces ${VAR_NAME} placeholders with environment variables
   */
  private static replaceEnvVariables(obj: any): void {
    dotenv.config();

    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        const match = obj[key].match(/\$\{([^}]+)\}/);
        if (match) {
          const envVar = match[1];
          obj[key] = process.env[envVar] || obj[key];
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.replaceEnvVariables(obj[key]);
      }
    }
  }

  /**
   * Creates a sample configuration file
   */
  static createSampleConfig(outputPath: string = 'mssqlgen.config.yaml'): void {
    const sampleConfig = `# MSSQL to StepZen Schema Generator Configuration

database:
  server: localhost
  database: mydb
  user: sa
  password: \${DB_PASSWORD}  # Use environment variable
  port: 1433
  options:
    encrypt: true
    trustServerCertificate: true

generation:
  outputDir: ./stepzen
  
  # Optional: Specify which tables to generate schemas for
  # Use schema-qualified names (schema.table) with wildcard support
  # If empty or omitted, all tables from all non-system schemas are included
  tables:
    # Examples:
    # - "Sales.*"              # All tables from Sales schema
    # - "Warehouse.*"          # All tables from Warehouse schema  
    # - "Sales.Customer"       # Specific table from specific schema
    # - "*.Orders"             # Orders table from any schema
    # - "Production.Product*"  # Product* tables from Production schema
  
  # Optional: Naming conventions for generated types
  naming:
    typePrefix: ""
    typeSuffix: ""
    fieldCase: camelCase  # Options: camelCase, snake_case, PascalCase
  
  # Optional: Feature flags for future enhancements
  features:
    generateMutations: true
    generateRelationships: true
    autoIncludeForeignKeyTables: false
    
    # Filtering configuration
    filtering:
      enabled: false
      tables: []  # Empty means all tables (e.g., ["Sales.*", "Warehouse.*"])
      operators: ["eq", "ne", "lt", "gt", "le", "ge", "like", "ilike"]
      enableLogicalOps: true
      useShorthands: true
    
    # Pagination configuration
    pagination:
      enabled: false
      defaultPageSize: 10
      tables: []
`;

    fs.writeFileSync(outputPath, sampleConfig, 'utf-8');
    console.log(`Sample configuration created: ${outputPath}`);
  }
}
