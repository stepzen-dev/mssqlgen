import * as fs from 'fs';
import * as path from 'path';

export class FileWriter {
  /**
   * Ensures a directory exists, creating it if necessary
   */
  static ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Writes content to a file
   */
  static writeFile(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    this.ensureDirectory(dir);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Writes a GraphQL schema file
   */
  static writeSchemaFile(outputDir: string, fileName: string, content: string): string {
    const typesDir = path.join(outputDir, 'types');
    this.ensureDirectory(typesDir);
    
    const filePath = path.join(typesDir, `${fileName}.graphql`);
    this.writeFile(filePath, content);
    
    return filePath;
  }

  /**
   * Writes the StepZen config.yaml file
   */
  static writeConfigFile(outputDir: string, content: string): string {
    const filePath = path.join(outputDir, 'config.yaml');
    this.writeFile(filePath, content);
    return filePath;
  }

  /**
   * Writes the index.graphql file
   */
  static writeIndexFile(outputDir: string, content: string): string {
    const filePath = path.join(outputDir, 'index.graphql');
    this.writeFile(filePath, content);
    return filePath;
  }

  /**
   * Cleans the output directory
   */
  static cleanDirectory(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }

  /**
   * Checks if a file exists
   */
  static fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Reads a file's content
   */
  static readFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
  }
}
