/**
 * Maps SQL Server data types to GraphQL types
 */
export class TypeMapper {
  private static readonly TYPE_MAP: Record<string, string> = {
    // Integer types
    'int': 'Int',
    'bigint': 'Int', // Could be BigInt custom scalar
    'smallint': 'Int',
    'tinyint': 'Int',
    
    // Decimal/Numeric types
    'decimal': 'Float',
    'numeric': 'Float',
    'money': 'Float',
    'smallmoney': 'Float',
    'float': 'Float',
    'real': 'Float',
    
    // String types
    'varchar': 'String',
    'nvarchar': 'String',
    'char': 'String',
    'nchar': 'String',
    'text': 'String',
    'ntext': 'String',
    
    // Boolean
    'bit': 'Boolean',
    
    // Date/Time types
    'date': 'String',
    'datetime': 'String',
    'datetime2': 'String',
    'smalldatetime': 'String',
    'time': 'String',
    'datetimeoffset': 'String',
    
    // Binary types
    'binary': 'String',
    'varbinary': 'String',
    'image': 'String',
    
    // Unique identifier
    'uniqueidentifier': 'ID',
    
    // XML and JSON
    'xml': 'String',
    'json': 'JSON', // Custom scalar
    
    // Other types
    'sql_variant': 'String',
    'timestamp': 'String',
    'rowversion': 'String',
  };

  /**
   * Maps a SQL Server data type to a GraphQL type
   */
  static mapType(sqlType: string): string {
    const normalizedType = sqlType.toLowerCase();
    return this.TYPE_MAP[normalizedType] || 'String';
  }

  /**
   * Formats a GraphQL field type with nullability
   */
  static formatFieldType(graphqlType: string, isNullable: boolean): string {
    return isNullable ? graphqlType : `${graphqlType}!`;
  }

  /**
   * Converts a SQL column name to camelCase for GraphQL
   */
  static toCamelCase(name: string): string {
    return name
      .split('_')
      .map((part, index) => {
        if (index === 0) {
          return part.toLowerCase();
        }
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join('');
  }

  /**
   * Converts a SQL table name to PascalCase for GraphQL type
   */
  static toPascalCase(name: string): string {
    return name
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Pluralizes a table name for query names
   */
  static pluralize(name: string): string {
    // Simple pluralization rules
    if (name.endsWith('s') || name.endsWith('x') || name.endsWith('ch') || name.endsWith('sh')) {
      return `${name}es`;
    }
    if (name.endsWith('y') && !this.isVowel(name.charAt(name.length - 2))) {
      return `${name.slice(0, -1)}ies`;
    }
    return `${name}s`;
  }

  /**
   * Singularizes a table name
   */
  static singularize(name: string): string {
    if (name.endsWith('ies')) {
      return `${name.slice(0, -3)}y`;
    }
    if (name.endsWith('es')) {
      return name.slice(0, -2);
    }
    if (name.endsWith('s') && !name.endsWith('ss')) {
      return name.slice(0, -1);
    }
    return name;
  }

  private static isVowel(char: string): boolean {
    return ['a', 'e', 'i', 'o', 'u'].includes(char.toLowerCase());
  }

  /**
   * Generates a query name for fetching multiple records
   */
  static getListQueryName(tableName: string): string {
    const pascalCase = this.toPascalCase(tableName);
    const camelCase = pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1);
    return this.pluralize(camelCase);
  }

  /**
   * Generates a query name for fetching a single record
   */
  static getSingleQueryName(tableName: string): string {
    const pascalCase = this.toPascalCase(tableName);
    return pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1);
  }
}
