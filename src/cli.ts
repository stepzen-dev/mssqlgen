#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { MSSQLSchemaGenerator } from './core/generator';
import { ConfigLoader } from './utils/config-loader';
import { Config } from './types';

const program = new Command();

program
  .name('mssqlgen')
  .description('Generate StepZen GraphQL schemas from Microsoft SQL Server databases')
  .version('1.0.0');

// Generate command
program
  .command('generate')
  .description('Generate StepZen schema from MSSQL database')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-s, --server <server>', 'Database server')
  .option('-d, --database <database>', 'Database name')
  .option('-u, --user <user>', 'Database user')
  .option('-p, --password <password>', 'Database password')
  .option('-o, --output <dir>', 'Output directory', './stepzen')
  .option('--tables <tables>', 'Comma-separated list of tables to include')
  .option('--dry-run', 'Preview without writing files')
  .action(async (options) => {
    try {
      let config: Config;

      // Load configuration
      if (options.config) {
        config = ConfigLoader.load(options.config);
      } else if (options.server && options.database && options.user && options.password) {
        // Build config from CLI options
        config = {
          database: {
            server: options.server,
            database: options.database,
            user: options.user,
            password: options.password,
            options: {
              encrypt: true,
              trustServerCertificate: true,
            },
          },
          generation: {
            outputDir: options.output,
            tables: options.tables
              ? options.tables.split(',').map((t: string) => t.trim())
              : undefined,
          },
        };
      } else {
        config = ConfigLoader.load();
      }

      // Validate configuration
      ConfigLoader.validate(config);

      console.log(chalk.blue('\n🚀 MSSQL to StepZen Schema Generator\n'));
      console.log(chalk.gray(`Server: ${config.database.server}`));
      console.log(chalk.gray(`Database: ${config.database.database}`));
      console.log(chalk.gray(`Output: ${config.generation.outputDir}\n`));

      if (options.dryRun) {
        console.log(chalk.yellow('⚠️  Dry run mode - no files will be written\n'));
      }

      // Create generator
      const generator = new MSSQLSchemaGenerator(config);

      // Test connection first
      const connected = await generator.testConnection();
      if (!connected) {
        console.error(chalk.red('\n✗ Failed to connect to database'));
        process.exit(1);
      }

      if (!options.dryRun) {
        // Generate schema
        await generator.generate();
      } else {
        // Just list tables in dry run
        const tables = await generator.listTables();
        console.log(chalk.blue(`\nTables that would be processed (${tables.length}):`));
        tables.forEach(table => console.log(chalk.gray(`  - ${table}`)));
      }
    } catch (error) {
      console.error(chalk.red('\n✗ Error:'), error);
      process.exit(1);
    }
  });

// Init command
program
  .command('init')
  .description('Create a sample configuration file')
  .option('-o, --output <path>', 'Output path for config file', 'mssqlgen.config.yaml')
  .action((options) => {
    try {
      ConfigLoader.createSampleConfig(options.output);
      console.log(chalk.green(`\n✓ Configuration file created: ${options.output}`));
      console.log(chalk.blue('\nNext steps:'));
      console.log(chalk.gray('  1. Edit the configuration file with your database details'));
      console.log(chalk.gray('  2. Create a .env file with sensitive values (e.g., DB_PASSWORD)'));
      console.log(chalk.gray('  3. Run: mssqlgen generate\n'));
    } catch (error) {
      console.error(chalk.red('\n✗ Error:'), error);
      process.exit(1);
    }
  });

// Test command
program
  .command('test')
  .description('Test database connection')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      const config = ConfigLoader.load(options.config);
      ConfigLoader.validate(config);

      console.log(chalk.blue('\n🔌 Testing database connection...\n'));
      console.log(chalk.gray(`Server: ${config.database.server}`));
      console.log(chalk.gray(`Database: ${config.database.database}\n`));

      const generator = new MSSQLSchemaGenerator(config);
      const connected = await generator.testConnection();

      if (connected) {
        console.log(chalk.green('\n✓ Connection successful!\n'));
        process.exit(0);
      } else {
        console.log(chalk.red('\n✗ Connection failed\n'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('\n✗ Error:'), error);
      process.exit(1);
    }
  });

// List schemas command
program
  .command('list-schemas')
  .description('List all schemas in the database')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      const config = ConfigLoader.load(options.config);
      ConfigLoader.validate(config);

      const generator = new MSSQLSchemaGenerator(config);
      const schemas = await generator.listSchemas();

      console.log(chalk.blue(`\n📂 Schemas in ${config.database.database} (${schemas.length}):\n`));
      schemas.forEach(schema => console.log(chalk.gray(`  - ${schema}`)));
      console.log();
    } catch (error) {
      console.error(chalk.red('\n✗ Error:'), error);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List all tables in the database')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-s, --schemas <schemas>', 'Comma-separated list of schemas to filter')
  .action(async (options) => {
    try {
      const config = ConfigLoader.load(options.config);
      ConfigLoader.validate(config);

      const generator = new MSSQLSchemaGenerator(config);
      const schemas = options.schemas ? options.schemas.split(',').map((s: string) => s.trim()) : undefined;
      const tables = await generator.listTables(schemas);

      console.log(chalk.blue(`\n📋 Tables in ${config.database.database} (${tables.length}):\n`));
      
      // Group by schema
      const bySchema: Record<string, string[]> = {};
      tables.forEach(t => {
        if (!bySchema[t.schema]) bySchema[t.schema] = [];
        bySchema[t.schema].push(t.table);
      });

      Object.keys(bySchema).sort().forEach(schema => {
        console.log(chalk.cyan(`\n  ${schema}:`));
        bySchema[schema].forEach(table => console.log(chalk.gray(`    - ${table}`)));
      });
      console.log();
    } catch (error) {
      console.error(chalk.red('\n✗ Error:'), error);
      process.exit(1);
    }
  });

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Interactive mode with prompts')
  .action(async () => {
    try {
      console.log(chalk.blue('\n🚀 MSSQL to StepZen Schema Generator - Interactive Mode\n'));

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'server',
          message: 'Database server:',
          default: 'localhost',
        },
        {
          type: 'input',
          name: 'database',
          message: 'Database name:',
        },
        {
          type: 'input',
          name: 'user',
          message: 'Database user:',
          default: 'sa',
        },
        {
          type: 'password',
          name: 'password',
          message: 'Database password:',
          mask: '*',
        },
        {
          type: 'input',
          name: 'output',
          message: 'Output directory:',
          default: './stepzen',
        },
        {
          type: 'confirm',
          name: 'testConnection',
          message: 'Test connection before generating?',
          default: true,
        },
      ]);

      const config: Config = {
        database: {
          server: answers.server,
          database: answers.database,
          user: answers.user,
          password: answers.password,
          options: {
            encrypt: true,
            trustServerCertificate: true,
          },
        },
        generation: {
          outputDir: answers.output,
        },
      };

      const generator = new MSSQLSchemaGenerator(config);

      if (answers.testConnection) {
        const connected = await generator.testConnection();
        if (!connected) {
          console.error(chalk.red('\n✗ Connection failed. Please check your credentials.\n'));
          process.exit(1);
        }
      }

      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Proceed with schema generation?',
          default: true,
        },
      ]);

      if (proceed) {
        await generator.generate();
      } else {
        console.log(chalk.yellow('\nGeneration cancelled.\n'));
      }
    } catch (error) {
      console.error(chalk.red('\n✗ Error:'), error);
      process.exit(1);
    }
  });

program.parse();
