import { TableInfo, GraphQLType, GraphQLField, GraphQLQuery } from '../types';
import { TypeMapper } from '../utils/type-mapper';

export class SchemaGenerator {
  /**
   * Generates a GraphQL type definition from table info
   */
  generateType(table: TableInfo): GraphQLType {
    const typeName = TypeMapper.toPascalCase(table.name);
    
    const fields: GraphQLField[] = table.columns.map(column => ({
      name: TypeMapper.toCamelCase(column.name),
      type: TypeMapper.mapType(column.dataType),
      nullable: column.isNullable,
      description: undefined,
    }));

    return {
      name: typeName,
      fields,
      description: undefined,
    };
  }

  /**
   * Generates GraphQL queries for a table
   */
  generateQueries(table: TableInfo, databaseName: string): GraphQLQuery[] {
    const queries: GraphQLQuery[] = [];
    const typeName = TypeMapper.toPascalCase(table.name);
    const primaryKey = table.primaryKeys[0]; // Assuming single primary key for now

    // List query (get all records)
    queries.push({
      name: TypeMapper.getListQueryName(table.name),
      returnType: `[${typeName}]`,
      arguments: [],
      dbQuery: `SELECT * FROM ${table.schema}.${table.name}`,
    });

    // Single record query (by primary key)
    if (primaryKey) {
      const pkColumn = table.columns.find(col => col.name === primaryKey);
      if (pkColumn) {
        const pkType = TypeMapper.mapType(pkColumn.dataType);
        queries.push({
          name: TypeMapper.getSingleQueryName(table.name),
          returnType: typeName,
          arguments: [
            {
              name: TypeMapper.toCamelCase(primaryKey),
              type: pkType,
              required: true,
            },
          ],
          dbQuery: `SELECT * FROM ${table.schema}.${table.name} WHERE ${primaryKey} = ?`,
        });
      }
    }

    return queries;
  }

  /**
   * Generates the GraphQL schema file content
   */
  generateSchemaFile(type: GraphQLType, queries: GraphQLQuery[], databaseName: string): string {
    let schema = '';

    // Add type definition
    schema += this.generateTypeDefinition(type);
    schema += '\n\n';

    // Add Query type
    schema += 'type Query {\n';
    queries.forEach(query => {
      schema += this.generateQueryDefinition(query, databaseName, type.name);
    });
    schema += '}\n';

    return schema;
  }

  /**
   * Generates a GraphQL type definition string
   */
  private generateTypeDefinition(type: GraphQLType): string {
    let def = '';
    
    if (type.description) {
      def += `"""${type.description}"""\n`;
    }
    
    def += `type ${type.name} {\n`;
    
    type.fields.forEach(field => {
      if (field.description) {
        def += `  """${field.description}"""\n`;
      }
      const fieldType = TypeMapper.formatFieldType(field.type, field.nullable);
      def += `  ${field.name}: ${fieldType}\n`;
    });
    
    def += '}';
    
    return def;
  }

  /**
   * Generates a query definition with @dbquery directive
   */
  private generateQueryDefinition(query: GraphQLQuery, databaseName: string, typeName: string): string {
    let def = '  ';
    
    // Query signature
    def += query.name;
    
    if (query.arguments.length > 0) {
      def += '(';
      def += query.arguments
        .map(arg => {
          const argType = arg.required ? `${arg.type}!` : arg.type;
          return `${arg.name}: ${argType}`;
        })
        .join(', ');
      def += ')';
    }
    
    def += `: ${query.returnType}`;
    
    // Add @dbquery directive
    def += '\n    @dbquery(\n';
    def += `      type: "mssql"\n`;
    def += `      query: """\n`;
    def += `        ${query.dbQuery}\n`;
    def += `      """\n`;
    def += `      configuration: "mssql_config"\n`;
    def += '    )\n';
    
    return def;
  }

  /**
   * Generates StepZen config.yaml content
   */
  generateConfigYaml(databaseName: string, connectionString: string): string {
    return `configurationset:
  - configuration:
      name: mssql_config
      dsn: ${connectionString}
`;
  }

  /**
   * Generates index.graphql that imports all schema files
   */
  generateIndexFile(tableNames: string[]): string {
    let content = '# StepZen Schema Index\n\n';
    
    tableNames.forEach(tableName => {
      const fileName = tableName.toLowerCase();
      content += `schema @sdl(files: ["types/${fileName}.graphql"]) {\n`;
      content += '  query: Query\n';
      content += '}\n\n';
    });
    
    return content;
  }
}
