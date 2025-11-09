import { DatabaseConnector } from './database';
import { SchemaGenerator } from '../generators/schema-generator';
import { FilterGenerator } from '../generators/filter-generator';
import { FileWriter } from '../utils/file-writer';
import { Config, TableInfo } from '../types';
import chalk from 'chalk';
import ora from 'ora';

export class MSSQLSchemaGenerator {
  private db: DatabaseConnector;
  private schemaGen: SchemaGenerator;
  private filterGen: FilterGenerator;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.db = new DatabaseConnector(config.database);
    this.schemaGen = new SchemaGenerator();
    this.filterGen = new FilterGenerator();
  }

  /**
   * Main generation process
   */
  async generate(): Promise<void> {
    const spinner = ora('Connecting to database...').start();

    try {
      // Connect to database
      await this.db.connect();
      spinner.succeed('Connected to database');

      // Get list of tables
      spinner.start('Fetching table list...');
      const allTables = await this.db.getTables();
      spinner.succeed(`Found ${allTables.length} tables`);

      // Filter tables based on config patterns
      let filteredTables = this.filterTables(allTables);
      
      // Auto-include foreign key tables if enabled
      if (this.config.generation.features?.generateRelationships && 
          this.config.generation.features?.autoIncludeForeignKeyTables) {
        filteredTables = await this.autoIncludeForeignKeyTables(filteredTables, allTables);
      }
      
      console.log(chalk.blue(`Processing ${filteredTables.length} tables`));

      // Clean output directory
      if (this.config.generation.outputDir) {
        FileWriter.cleanDirectory(this.config.generation.outputDir);
      }

      const processedTables: string[] = [];
      const processedTableSet = new Set<string>();

      // Process each table
      for (const tableName of filteredTables) {
        spinner.start(`Processing table: ${tableName}`);

        try {
          // Parse schema and table name
          const [schema, table] = tableName.includes('.') 
            ? tableName.split('.') 
            : ['dbo', tableName];

          // Get table information
          const tableInfo = await this.db.getTableInfo(table, schema);

          // Check for missing FK references and warn
          if (this.config.generation.features?.generateRelationships && 
              !this.config.generation.features?.autoIncludeForeignKeyTables) {
            this.warnMissingForeignKeyTables(tableInfo, processedTableSet, filteredTables);
          }

          // Generate GraphQL type with relationships
          const generateRelationships = this.config.generation.features?.generateRelationships ?? false;
          const graphqlType = this.schemaGen.generateType(tableInfo, generateRelationships);

          // Check if filtering is enabled for this table
          const filteringEnabled = this.config.generation.features?.filtering?.enabled ?? false;
          const filterTables = this.config.generation.features?.filtering?.tables ?? [];
          const enableFiltering = filteringEnabled && 
            this.filterGen.shouldEnableFiltering(tableName, filterTables);

          // Generate filter type if filtering is enabled
          let filterType: string | undefined;
          if (enableFiltering) {
            const filterConfig = {
              operators: this.config.generation.features?.filtering?.operators ?? ['eq', 'ne', 'lt', 'gt', 'le', 'ge'],
              enableLogicalOps: this.config.generation.features?.filtering?.enableLogicalOps ?? true,
              useShorthands: this.config.generation.features?.filtering?.useShorthands ?? true,
            };
            filterType = this.filterGen.generateTableFilterType(tableInfo, filterConfig);
          }

          // Generate queries
          const queries = this.schemaGen.generateQueries(
            tableInfo,
            this.config.database.database,
            enableFiltering
          );

          // Generate schema file content
          const schemaContent = this.schemaGen.generateSchemaFile(
            graphqlType,
            queries,
            this.config.database.database,
            generateRelationships ? tableInfo.foreignKeys : [],
            filterType
          );

          // Write schema file
          const fileName = tableName.toLowerCase();
          FileWriter.writeSchemaFile(
            this.config.generation.outputDir,
            fileName,
            schemaContent
          );

          processedTables.push(tableName);
          processedTableSet.add(tableName);
          spinner.succeed(`Processed: ${tableName}`);
        } catch (error) {
          spinner.fail(`Failed to process ${tableName}: ${error}`);
          console.error(chalk.red(`Error details: ${error}`));
        }
      }

      // Generate shared filter types if filtering is enabled
      const filteringEnabled = this.config.generation.features?.filtering?.enabled ?? false;
      if (filteringEnabled) {
        spinner.start('Generating shared filter types...');
        const filterConfig = {
          operators: this.config.generation.features?.filtering?.operators ?? ['eq', 'ne', 'lt', 'gt', 'le', 'ge'],
          enableLogicalOps: this.config.generation.features?.filtering?.enableLogicalOps ?? true,
          useShorthands: this.config.generation.features?.filtering?.useShorthands ?? true,
        };
        const sharedFilters = this.filterGen.generateSharedFilterTypes(filterConfig);
        FileWriter.writeSchemaFile(
          this.config.generation.outputDir,
          'filters',
          sharedFilters
        );
        processedTables.push('filters');
        spinner.succeed('Generated shared filter types');
      }

      // Generate index.graphql
      spinner.start('Generating index file...');
      const indexContent = this.schemaGen.generateIndexFile(processedTables);
      FileWriter.writeIndexFile(this.config.generation.outputDir, indexContent);
      spinner.succeed('Generated index.graphql');

      // Generate config.yaml
      spinner.start('Generating StepZen config...');
      const connectionString = this.buildConnectionString();
      const configContent = this.schemaGen.generateConfigYaml(
        this.config.database.database,
        connectionString
      );
      FileWriter.writeConfigFile(this.config.generation.outputDir, configContent);
      spinner.succeed('Generated config.yaml');

      // Disconnect
      await this.db.disconnect();

      console.log(chalk.green('\n✓ Schema generation completed successfully!'));
      console.log(chalk.blue(`Output directory: ${this.config.generation.outputDir}`));
      console.log(chalk.blue(`Total tables processed: ${processedTables.length}`));
    } catch (error) {
      spinner.fail('Schema generation failed');
      throw error;
    }
  }

  /**
   * Tests the database connection
   */
  async testConnection(): Promise<boolean> {
    const spinner = ora('Testing database connection...').start();

    try {
      const result = await this.db.testConnection();
      if (result) {
        spinner.succeed('Database connection successful');
        return true;
      } else {
        spinner.fail('Database connection failed');
        return false;
      }
    } catch (error) {
      spinner.fail(`Connection test failed: ${error}`);
      return false;
    }
  }

  /**
   * Lists all schemas in the database
   */
  async listSchemas(): Promise<string[]> {
    await this.db.connect();
    const schemas = await this.db.getSchemas();
    await this.db.disconnect();
    return schemas;
  }

  /**
   * Lists all tables in the database
   */
  async listTables(schemas?: string[]): Promise<Array<{ schema: string; table: string; fullName: string }>> {
    await this.db.connect();
    const tables = await this.db.getTables(schemas);
    await this.db.disconnect();
    return tables;
  }

  /**
   * Filters tables based on config patterns
   * If no patterns specified, returns all tables
   */
  private filterTables(tables: Array<{ schema: string; table: string; fullName: string }>): string[] {
    const patterns = this.config.generation.tables || [];

    // If no patterns specified, return all table names
    if (patterns.length === 0) {
      return tables.map(t => t.fullName);
    }

    // Filter tables that match any pattern
    const filtered = tables.filter(table =>
      patterns.some(pattern => this.matchTablePattern(table.fullName, pattern))
    );

    return filtered.map(t => t.fullName);
  }

  /**
   * Auto-includes tables referenced by foreign keys
   */
  private async autoIncludeForeignKeyTables(
    filteredTables: string[],
    allTables: Array<{ schema: string; table: string; fullName: string }>
  ): Promise<string[]> {
    const tablesToProcess = new Set(filteredTables);
    const processed = new Set<string>();
    const queue = [...filteredTables];

    while (queue.length > 0) {
      const tableName = queue.shift()!;
      if (processed.has(tableName)) continue;
      processed.add(tableName);

      const [schema, table] = tableName.includes('.') 
        ? tableName.split('.') 
        : ['dbo', tableName];

      try {
        const tableInfo = await this.db.getTableInfo(table, schema);
        
        for (const fk of tableInfo.foreignKeys) {
          const referencedFullName = `${fk.referencedSchema}.${fk.referencedTable}`;
          
          if (!tablesToProcess.has(referencedFullName)) {
            // Check if the referenced table exists in the database
            const exists = allTables.some(t => t.fullName === referencedFullName);
            if (exists) {
              tablesToProcess.add(referencedFullName);
              queue.push(referencedFullName);
              console.log(chalk.cyan(`  ℹ Auto-added ${referencedFullName} (referenced by ${tableName})`));
            }
          }
        }
      } catch (error) {
        // Skip tables that can't be processed
        console.log(chalk.yellow(`  ⚠ Could not process FK for ${tableName}: ${error}`));
      }
    }

    return Array.from(tablesToProcess);
  }

  /**
   * Warns about missing foreign key tables
   */
  private warnMissingForeignKeyTables(
    tableInfo: TableInfo,
    processedTables: Set<string>,
    allTables: string[]
  ): void {
    for (const fk of tableInfo.foreignKeys) {
      const referencedFullName = `${fk.referencedSchema}.${fk.referencedTable}`;
      
      if (!allTables.includes(referencedFullName) && !processedTables.has(referencedFullName)) {
        console.log(chalk.yellow(
          `  ⚠ Warning: ${tableInfo.schema}.${tableInfo.name} references ${referencedFullName} via ${fk.columnName},\n` +
          `    but ${referencedFullName} is not in the generation set.\n` +
          `    Tip: Add "${referencedFullName}" to your tables list or enable autoIncludeForeignKeyTables.`
        ));
      }
    }
  }

  /**
   * Matches a schema.table string against a pattern with wildcard support
   * Pattern examples: "Sales.*", "*.Customer", "Sales.Order*", "dbo.Users"
   */
  private matchTablePattern(fullTableName: string, pattern: string): boolean {
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')  // Escape dots
      .replace(/\*/g, '.*')   // * becomes .*
      .replace(/\?/g, '.');   // ? becomes .
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(fullTableName);
  }

  /**
   * Builds a connection string for StepZen config
   */
  private buildConnectionString(): string {
    const { server, database, user, password, port } = this.config.database;
    return `mssql://${user}:${password}@${server}:${port || 1433}/${database}`;
  }
}
