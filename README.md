# MSSQL to StepZen Schema Generator

A powerful CLI utility that automatically generates StepZen GraphQL schemas from Microsoft SQL Server databases. Connect to your MSSQL database, introspect the schema, and generate production-ready GraphQL types, queries, and StepZen configuration files.

## Features

- 🔌 **Easy Database Connection** - Connect to MSSQL with simple configuration
- 🔍 **Automatic Schema Introspection** - Discovers tables, columns, types, and relationships
- 🎯 **Smart Type Mapping** - Converts SQL Server types to appropriate GraphQL types
- 📝 **StepZen Integration** - Generates ready-to-use StepZen schemas with @dbquery directives
- 🎨 **Flexible Configuration** - YAML config files or environment variables
- 🚀 **Multiple Modes** - Interactive, CLI, or config-file driven
- 🔐 **Secure** - Environment variable support for sensitive credentials
- 🎛️ **Table Filtering** - Include/exclude specific tables with patterns
- 📦 **Batch Processing** - Process multiple tables efficiently

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd mssqlgen

# Install dependencies
npm install

# Build the project
npm run build

# Link for global usage (optional)
npm link
```

## Quick Start

### 1. Initialize Configuration

```bash
mssqlgen init
```

This creates a `mssqlgen.config.yaml` file in your current directory.

### 2. Configure Database Connection

Edit `mssqlgen.config.yaml`:

```yaml
database:
  server: localhost
  database: mydb
  user: sa
  password: ${DB_PASSWORD}
  port: 1433
  options:
    encrypt: true
    trustServerCertificate: true

generation:
  outputDir: ./stepzen
```

Create a `.env` file:

```env
DB_PASSWORD=your_secure_password
```

### 3. Test Connection

```bash
mssqlgen test
```

### 4. Generate Schema

```bash
mssqlgen generate
```

## Usage

### Commands

#### `generate` - Generate StepZen Schema

```bash
# Using config file
mssqlgen generate --config mssqlgen.config.yaml

# Using CLI options
mssqlgen generate \
  --server localhost \
  --database mydb \
  --user sa \
  --password mypassword \
  --output ./stepzen

# Generate specific tables only
mssqlgen generate --tables Customer,Order,Product

# Dry run (preview without writing files)
mssqlgen generate --dry-run
```

#### `init` - Create Configuration File

```bash
# Create default config
mssqlgen init

# Create config at custom path
mssqlgen init --output my-config.yaml
```

#### `test` - Test Database Connection

```bash
# Test using config file
mssqlgen test

# Test using specific config
mssqlgen test --config my-config.yaml
```

#### `list` - List Database Tables

```bash
# List all tables
mssqlgen list

# List using specific config
mssqlgen list --config my-config.yaml
```

#### `interactive` - Interactive Mode

```bash
mssqlgen interactive
# or
mssqlgen i
```

Prompts you for all configuration options interactively.

## Configuration

### Configuration File Structure

```yaml
database:
  server: localhost          # Database server address
  database: mydb            # Database name
  user: sa                  # Database user
  password: ${DB_PASSWORD}  # Password (use env var)
  port: 1433               # Port (optional, default: 1433)
  options:
    encrypt: true                    # Enable encryption
    trustServerCertificate: true     # Trust self-signed certs
    connectionTimeout: 30000         # Connection timeout (ms)
    requestTimeout: 30000            # Request timeout (ms)

generation:
  outputDir: ./stepzen      # Output directory
  
  tables:
    include:                # Tables to include (optional)
      - "Customer"
      - "Order*"           # Supports wildcards
    exclude:                # Tables to exclude (optional)
      - "sysdiagrams"
      - "sys*"
      - "__*"
  
  naming:
    typePrefix: ""          # Prefix for type names
    typeSuffix: ""          # Suffix for type names
    fieldCase: camelCase    # Field naming: camelCase, snake_case, PascalCase
  
  features:
    generateMutations: true        # Generate mutations (future)
    generateRelationships: true    # Generate relationships (future)
    includePagination: false       # Include pagination (future)
```

### Environment Variables

```env
# Database Connection
DB_SERVER=localhost
DB_DATABASE=mydb
DB_USER=sa
DB_PASSWORD=your_password
DB_PORT=1433

# Connection Options
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

# Generation Options
OUTPUT_DIR=./stepzen
GENERATE_MUTATIONS=true
GENERATE_RELATIONSHIPS=true
```

## Generated Output

The tool generates a complete StepZen schema structure:

```
stepzen/
├── config.yaml              # StepZen configuration
├── index.graphql           # Main schema index
└── types/
    ├── customer.graphql    # Customer type and queries
    ├── order.graphql       # Order type and queries
    └── product.graphql     # Product type and queries
```

### Example Generated Schema

**types/customer.graphql:**

```graphql
"""Type for dbo.Customer table"""
type Customer {
  """Primary Key, Auto-increment"""
  customerId: Int!
  firstName: String!
  lastName: String!
  email: String
  createdAt: String!
}

type Query {
  customers: [Customer]
    @dbquery(
      type: "mydb"
      query: """
        SELECT * FROM dbo.Customer
      """
      configuration: "mssql_config"
    )
  
  customer(customerId: Int!): Customer
    @dbquery(
      type: "mydb"
      query: """
        SELECT * FROM dbo.Customer WHERE CustomerId = @customerId
      """
      configuration: "mssql_config"
    )
}
```

## Type Mapping

| SQL Server Type | GraphQL Type | Notes |
|----------------|--------------|-------|
| INT, BIGINT, SMALLINT, TINYINT | Int | |
| DECIMAL, NUMERIC, MONEY, FLOAT | Float | |
| VARCHAR, NVARCHAR, CHAR, TEXT | String | |
| BIT | Boolean | |
| DATE, DATETIME, DATETIME2 | String | ISO 8601 format |
| UNIQUEIDENTIFIER | ID | UUID format |
| VARBINARY, BINARY | String | Base64 encoded |

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev -- generate --config examples/mssqlgen.config.yaml

# Build
npm run build

# Run tests (when available)
npm test

# Lint
npm run lint

# Format code
npm run format
```

## Examples

### Basic Usage

```bash
# Generate schema for entire database
mssqlgen generate

# Generate for specific tables
mssqlgen generate --tables Customer,Order,Product

# Preview without writing files
mssqlgen generate --dry-run
```

### Using with Docker

```bash
# Start MSSQL in Docker
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourStrong@Passw0rd" \
  -p 1433:1433 --name mssql \
  -d mcr.microsoft.com/mssql/server:2019-latest

# Generate schema
mssqlgen generate \
  --server localhost \
  --database master \
  --user sa \
  --password "YourStrong@Passw0rd"
```

### CI/CD Integration

```yaml
# .github/workflows/generate-schema.yml
name: Generate GraphQL Schema

on:
  push:
    branches: [main]

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      
      - name: Install dependencies
        run: npm install
      
      - name: Generate schema
        env:
          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
        run: npm run build && node dist/cli.js generate
      
      - name: Commit generated schema
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add stepzen/
          git commit -m "Update generated schema" || exit 0
          git push
```

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to database

**Solutions:**
- Verify server address and port
- Check firewall settings
- Enable TCP/IP in SQL Server Configuration Manager
- Try `trustServerCertificate: true` for self-signed certificates

### Authentication Errors

**Problem:** Login failed for user

**Solutions:**
- Verify username and password
- Check SQL Server authentication mode (mixed mode required)
- Ensure user has appropriate permissions

### Empty Output

**Problem:** No tables found

**Solutions:**
- Check table filters in configuration
- Verify user has permissions to read schema
- Ensure you're connecting to the correct database

## Roadmap

### Phase 1 - MVP ✅
- [x] Database connection
- [x] Schema introspection
- [x] Basic type generation
- [x] Query generation
- [x] CLI interface

### Phase 2 - Enhanced
- [ ] Foreign key relationships
- [ ] @materializer directives
- [ ] View support
- [ ] Advanced filtering
- [ ] Custom naming conventions

### Phase 3 - Advanced
- [ ] Mutation generation
- [ ] Stored procedure mapping
- [ ] Pagination support
- [ ] Custom scalars
- [ ] Schema validation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.