# MSSQL to StepZen Schema Generator

A powerful CLI utility that automatically generates StepZen GraphQL schemas from Microsoft SQL Server databases. Connect to your MSSQL database, introspect the schema, and generate production-ready GraphQL types, queries, and StepZen configuration files with automatic foreign key relationship handling.

## Features

- 🔌 **Easy Database Connection** - Connect to MSSQL with simple configuration
- 🔍 **Automatic Schema Introspection** - Discovers tables, columns, types, and relationships
- 🎯 **Smart Type Mapping** - Converts SQL Server types to appropriate GraphQL types
- 🔗 **Foreign Key Relationships** - Automatically generates @materializer directives for related data
- 📝 **StepZen Integration** - Generates ready-to-use StepZen schemas with @dbquery directives
- 🎨 **Flexible Configuration** - YAML config files or environment variables
- 🚀 **Multiple Modes** - Interactive, CLI, or config-file driven
- 🔐 **Secure** - Environment variable support for sensitive credentials
- 🎛️ **Table Filtering** - Include specific tables with schema-qualified patterns
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
  tables:
    - "dbo.*"              # Include all tables in dbo schema
    - "Sales.Customer"     # Include specific table
    - "Sales.Order*"       # Include tables matching pattern
```

Create a `.env` file:

```env
DB_PASSWORD=your_secure_password
```

### 3. Test Connection

```bash
mssqlgen test
```

### 4. List Available Schemas

```bash
mssqlgen list-schemas
```

### 5. Generate Schema

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
mssqlgen generate --tables "Sales.*,dbo.Customer"

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

#### `list-schemas` - List Database Schemas

```bash
# List all schemas in the database
mssqlgen list-schemas

# List using specific config
mssqlgen list-schemas --config my-config.yaml
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
  
  # Table filtering with schema-qualified patterns
  tables:
    - "dbo.*"               # All tables in dbo schema
    - "Sales.*"             # All tables in Sales schema
    - "*.Customer"          # Customer table in any schema
    - "Sales.Order*"        # Tables starting with Order in Sales schema
    - "Application.People"  # Specific table
  
  # Feature flags
  autoIncludeForeignKeyTables: true  # Auto-include FK referenced tables
  
  naming:
    typePrefix: ""          # Prefix for type names
    typeSuffix: ""          # Suffix for type names
    fieldCase: camelCase    # Field naming: camelCase, snake_case, PascalCase
  
  features:
    generateMutations: true        # Generate mutations (future)
    generateRelationships: true    # Generate relationships with @materializer
    includePagination: false       # Include pagination (future)
```

### Table Filtering

The `tables` array supports schema-qualified patterns:

- `"dbo.*"` - All tables in the `dbo` schema
- `"Sales.*"` - All tables in the `Sales` schema
- `"*.Customer"` - Table named `Customer` in any schema
- `"Sales.Order*"` - Tables starting with `Order` in `Sales` schema
- `"Application.People"` - Specific table with schema

**Auto-Include Foreign Key Tables:**

When `autoIncludeForeignKeyTables: true`, the generator automatically includes tables that are referenced by foreign keys, even if they don't match your table patterns. This ensures complete relationship graphs.

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
type Customer {
  customerId: Int!
  firstName: String!
  lastName: String!
  email: String
  createdAt: String!
  orders: [Order]
    @materializer(
      query: "ordersByCustomerId"
      arguments: [{ name: "customerId", field: "customerId" }]
    )
}

type Query {
  customers: [Customer]
    @dbquery(
      type: "mssql"
      query: """
        SELECT * FROM dbo.Customer
      """
      configuration: "mssql_config"
    )
  
  customer(customerId: Int!): Customer
    @dbquery(
      type: "mssql"
      query: """
        SELECT * FROM dbo.Customer WHERE CustomerId = ?
      """
      configuration: "mssql_config"
    )
}
```

**types/order.graphql:**

```graphql
type Order {
  orderId: Int!
  customerId: Int!
  orderDate: String!
  totalAmount: Float
  customer: Customer
    @materializer(
      query: "customer"
      arguments: [{ name: "customerId", field: "customerId" }]
    )
}

type Query {
  orders: [Order]
    @dbquery(
      type: "mssql"
      query: """
        SELECT * FROM dbo.Order
      """
      configuration: "mssql_config"
    )
  
  order(orderId: Int!): Order
    @dbquery(
      type: "mssql"
      query: """
        SELECT * FROM dbo.Order WHERE OrderId = ?
      """
      configuration: "mssql_config"
    )
  
  ordersByCustomerId(customerId: Int!): [Order]
    @dbquery(
      type: "mssql"
      query: """
        SELECT * FROM dbo.Order WHERE CustomerId = ?
      """
      configuration: "mssql_config"
    )
}
```

## Foreign Key Relationships

The generator automatically detects foreign key relationships and creates:

1. **@materializer directives** - Links related types together
2. **Relationship queries** - Queries to fetch related data (e.g., `ordersByCustomerId`)
3. **Bidirectional relationships** - Both parent-to-child and child-to-parent

### How It Works

When a foreign key is detected (e.g., `Order.CustomerId` → `Customer.CustomerId`):

1. **Child Type** (`Order`) gets a field pointing to parent:
   ```graphql
   customer: Customer
     @materializer(
       query: "customer"
       arguments: [{ name: "customerId", field: "customerId" }]
     )
   ```

2. **Parent Type** (`Customer`) gets a field for children:
   ```graphql
   orders: [Order]
     @materializer(
       query: "ordersByCustomerId"
       arguments: [{ name: "customerId", field: "customerId" }]
     )
   ```

3. **Relationship Query** is generated:
   ```graphql
   ordersByCustomerId(customerId: Int!): [Order]
     @dbquery(
       type: "mssql"
       query: "SELECT * FROM dbo.Order WHERE CustomerId = ?"
       configuration: "mssql_config"
     )
   ```

### Benefits

- **Automatic Graph Traversal** - Navigate relationships naturally in GraphQL
- **Efficient Queries** - StepZen handles the data fetching
- **Type Safety** - Relationships are strongly typed
- **No Manual Configuration** - Everything is generated from database metadata

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

# Generate for specific schemas
mssqlgen generate --tables "Sales.*,Application.*"

# Generate specific tables
mssqlgen generate --tables "dbo.Customer,dbo.Order"

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
- Check table patterns in configuration (use schema-qualified patterns like "dbo.*")
- Verify user has permissions to read schema
- Ensure you're connecting to the correct database
- Use `list-schemas` command to see available schemas

## Roadmap

### Phase 1 - MVP ✅
- [x] Database connection
- [x] Schema introspection
- [x] Basic type generation
- [x] Query generation
- [x] CLI interface

### Phase 2 - Enhanced ✅
- [x] Foreign key relationships
- [x] @materializer directives
- [x] Schema-qualified table filtering
- [x] Auto-include FK referenced tables
- [ ] View support
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
