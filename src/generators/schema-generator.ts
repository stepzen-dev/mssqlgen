import { TableInfo, GraphQLType, GraphQLField, GraphQLQuery, ForeignKeyInfo } from '../types';
import { TypeMapper } from '../utils/type-mapper';

export class SchemaGenerator {
  /**
   * Generates a GraphQL type definition from table info
   */
  generateType(table: TableInfo, generateRelationships: boolean = false): GraphQLType {
    const typeName = TypeMapper.toPascalCase(table.name);
    
    const fields: GraphQLField[] = table.columns.map(column => ({
      name: TypeMapper.toCamelCase(column.name),
      type: TypeMapper.mapType(column.dataType),
      nullable: column.isNullable,
      description: undefined,
    }));

    // Add foreign key relationship fields if enabled
    if (generateRelationships && table.foreignKeys.length > 0) {
      table.foreignKeys.forEach(fk => {
        const relatedTypeName = TypeMapper.toPascalCase(fk.referencedTable);
        
        // Generate field name: <fkColumnWithoutId><TypeName>
        // e.g., lasteditedby + People = lasteditedbyPeople
        let fkFieldBase = TypeMapper.toCamelCase(fk.columnName);
        
        // Remove common ID suffixes
        fkFieldBase = fkFieldBase
          .replace(/Id$/, '')
          .replace(/ID$/, '')
          .replace(/_id$/, '')
          .replace(/_ID$/, '');
        
        const fieldName = fkFieldBase + relatedTypeName;
        
        fields.push({
          name: fieldName,
          type: relatedTypeName,
          nullable: true,
          description: undefined,
        });
      });
    }

    return {
      name: typeName,
      fields,
      description: undefined,
    };
  }

  /**
   * Generates GraphQL queries for a table
   */
  generateQueries(
    table: TableInfo, 
    databaseName: string,
    enableFiltering: boolean = false
  ): GraphQLQuery[] {
    const queries: GraphQLQuery[] = [];
    const typeName = TypeMapper.toPascalCase(table.name);
    const primaryKey = table.primaryKeys[0]; // Assuming single primary key for now

    // List query (get all records)
    // For list queries, store just the table name - will use 'table' argument
    const listQueryArgs = enableFiltering 
      ? [{ name: 'filter', type: `${typeName}Filter`, required: false }]
      : [];
    
    queries.push({
      name: TypeMapper.getListQueryName(table.name),
      returnType: `[${typeName}]`,
      arguments: listQueryArgs,
      dbQuery: `${table.schema}.${table.name}`,  // Just table name for 'table' argument
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
  generateSchemaFile(
    type: GraphQLType, 
    queries: GraphQLQuery[], 
    databaseName: string,
    foreignKeys: ForeignKeyInfo[] = [],
    filterType?: string
  ): string {
    let schema = '';

    // Add filter input type if provided
    if (filterType) {
      schema += filterType;
      schema += '\n';
    }

    // Add type definition
    schema += this.generateTypeDefinition(type, foreignKeys);
    schema += '\n\n';

    // Add Query type
    schema += 'type Query {\n';
    queries.forEach(query => {
      // Use table argument for list queries (simple SELECT *), query argument for specific queries
      const useTableArg = query.returnType.startsWith('[') && query.arguments.length <= 1;
      schema += this.generateQueryDefinition(query, databaseName, type.name, useTableArg);
    });
    schema += '}\n';

    return schema;
  }

  /**
   * Generates a GraphQL type definition string
   */
  private generateTypeDefinition(type: GraphQLType, foreignKeys: ForeignKeyInfo[] = []): string {
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
      def += `  ${field.name}: ${fieldType}`;
      
      // Add @materializer directive for foreign key fields
      // Match by checking if field name ends with the referenced type name
      const fk = foreignKeys.find(fk => {
        const typeName = TypeMapper.toPascalCase(fk.referencedTable);
        return field.name.endsWith(typeName) && field.type === typeName;
      });
      
      if (fk) {
        const queryName = TypeMapper.getSingleQueryName(fk.referencedTable);
        const fkColumnCamel = TypeMapper.toCamelCase(fk.columnName);
        def += `\n    @materializer(\n`;
        def += `      query: "${queryName}"\n`;
        def += `      arguments: [{name: "${TypeMapper.toCamelCase(fk.referencedColumn)}", field: "${fkColumnCamel}"}]\n`;
        def += `    )`;
      }
      
      def += '\n';
    });
    
    def += '}';
    
    return def;
  }

  /**
   * Generates a query definition with @dbquery directive
   */
  private generateQueryDefinition(
    query: GraphQLQuery, 
    databaseName: string, 
    typeName: string,
    useTableArg: boolean = false
  ): string {
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
    
    // Use table argument for simple queries, query argument for complex ones
    if (useTableArg) {
      def += `      table: "${query.dbQuery}"\n`;
    } else {
      def += `      query: """\n`;
      def += `        ${query.dbQuery}\n`;
      def += `      """\n`;
    }
    
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
    
    content += 'schema @sdl(files: [\n';
    tableNames.forEach((tableName, index) => {
      const fileName = tableName.toLowerCase();
      const comma = index < tableNames.length - 1 ? ',' : '';
      content += `  "types/${fileName}.graphql"${comma}\n`;
    });
    content += ']) {\n';
    content += '  query: Query\n';
    content += '}\n';
    
    return content;
  }
}
