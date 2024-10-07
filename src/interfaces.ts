export interface CompilerConfig {
  main: string;
  output: string;
  disableExperimentalSEAWarning?: boolean; 
}

export interface ReadlineConfig {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
}

export interface DirectoryCheckResult {
  exists: boolean;
  path: string;
}

export interface FileSystemUtils {
  isDirectory(dir: string): Promise<DirectoryCheckResult>;
  readDirectoryFiles(dir: string): Promise<string[]>;
  writeCompilerConfig(dir: string, config: CompilerConfig): void;
}

export interface CommandExecutor {
  executeCommand(command: string): Promise<void>;
}