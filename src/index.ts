import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  CompilerConfig,
  ReadlineConfig,
  DirectoryCheckResult,
  FileSystemUtils,
  CommandExecutor,
} from '#/interfaces.ts';

const readlineConfig: ReadlineConfig = {
  input: process.stdin,
  output: process.stdout,
};

const rl = readline.createInterface(readlineConfig);

const displayBanner = (): void => {
  console.clear();

  console.log(`
  \t    
  \t          ,gg,      ,ggggggg,           ,ggg,                                                                        
  \t     i8""8i   ,dP""""""Y8b         dP""8I                                      I8                          ,dPYb,
  \t     \`8,,8'   d8'    a  Y8        dP   88                                      I8                          IP'\`Yb
  \t      \`88'    88     "Y8P'       dP    88                                   88888888                       I8  8I
  \t      dP"8,   \`8baaaa           ,8'    88                                      I8                          I8  8'
  \t     dP' \`8a ,d8P""""           d88888888     ,ggg,      ,gg,   ,gg ,ggg,      I8     ,ggggg,    ,ggggg,   I8 dP 
  \t    dP'   \`Ybd8"          __   ,8"     88    i8" "8i    d8""8b,dP" i8" "8i     I8    dP"  "Y8gggdP"  "Y8gggI8dP  
  \t_ ,dP'     I8Y8,         dP"  ,8P      Y8    I8, ,8I   dP   ,88"   I8, ,8I    ,I8,  i8'    ,8I i8'    ,8I  I8P   
  \t"888,,____,dP\`Yba,,_____,Yb,_,dP       \`8b,  \`YbadP' ,dP  ,dP"Y8,  \`YbadP'   ,d88b,,d8,   ,d8',d8,   ,d8' ,d8b,_ 
  \ta8P"Y88888P"   \`"Y8888888 "Y8P"         \`Y8 888P"Y8888"  dP"   "Y8888P"Y888  8P""Y8P"Y8888P"  P"Y8888P"   8P'"Y88
  \t  
  `);
  
};

const promptUser = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

const fileSystemUtils: FileSystemUtils = {
  isDirectory: async (dir: string): Promise<DirectoryCheckResult> => {
    try {
      const stats = await promisify(fs.stat)(dir);
      return { exists: stats.isDirectory(), path: dir };
    } catch {
      return { exists: false, path: dir };
    }
  },
  readDirectoryFiles: async (dir: string): Promise<string[]> => {
    return promisify(fs.readdir)(dir);
  },
  writeCompilerConfig: (dir: string, config: CompilerConfig): void => {
    const configPath = path.join(dir, 'BUILD_CONFIG.json');
    fs.writeFileSync(configPath, JSON.stringify(config));
  },
};

const commandExecutor: CommandExecutor = {
  executeCommand: (command: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      exec(command, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  },
};

const getProjectDirectory = async (): Promise<void> => {
  displayBanner();
  const dir = await promptUser('[Directory] Project directory: ');
  var fileSystem = await fileSystemUtils.isDirectory(dir);

  if (!fileSystem.exists) {
    await promptUser('[Error] Directory does not exist. Press Enter to try again.');
    await getProjectDirectory();
    return;
  }

  console.log(`[Directory]: ${dir}`);
  const files = await fileSystemUtils.readDirectoryFiles(dir);
  files.forEach((file) => console.log(`- ${file}`));

  const buildDir = path.join(dir, 'build');
  var fileSystem = await fileSystemUtils.isDirectory(buildDir);
  if (!fileSystem.exists) {
    fs.mkdirSync(buildDir);
    await configureCompiler(buildDir, dir);
  }
};

const configureCompiler = async (buildDir: string, originalDir: string): Promise<void> => {
  const removeWarning = await promptUser('[Executable] Do you want to remove the ExperimentalWarning when creating the executable? (y/n): ');

  const config: CompilerConfig = {
    main: path.join(buildDir, 'bundle.js'),
    output: path.join(buildDir, 'app.blob'),
    disableExperimentalSEAWarning: removeWarning === 'y',
  };

  fileSystemUtils.writeCompilerConfig(buildDir, config);
  console.log('[Dependencies] New values added.');
  await buildExecutable(buildDir, originalDir);
};

const buildExecutable = async (buildDir: string, originalDir: string): Promise<void> => {
  console.log('[Executable] Modifying file...');
  await commandExecutor.executeCommand(`npx esbuild "${path.join(originalDir, 'index.js')}" --platform=node --bundle --outfile="${path.join(buildDir, 'bundle.js')}"`);
  console.log('[Executable] File modified.');

  console.log('[Executable] Creating executable configuration...');
  await commandExecutor.executeCommand(`node --experimental-sea-config ${path.join(buildDir, 'BUILD_CONFIG.json')}`);
  console.log('[Executable] Executable configuration created.');

  await generateOutputExecutable(buildDir);
};

const generateOutputExecutable = async (buildDir: string): Promise<void> => {
  console.log('[Executable] Generating "app.exe"...');
  await commandExecutor.executeCommand('node -e "require(\'fs\').copyFileSync(process.execPath, require(\'path\').join(process.env.TEMP || \'\', \'app.exe\'))"');
  console.log('[Executable] "app.exe" created.');

  await injectCodeToExecutable(buildDir);
};

const injectCodeToExecutable = async (buildDir: string): Promise<void> => {
  console.log('[Executable] Injecting code into "app.exe"...');
  await commandExecutor.executeCommand(`npx postject ${path.join(process.env.TEMP || '', 'app.exe')} NODE_SEA_BLOB "${path.join(buildDir, 'app.blob')}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`);

  console.log('[Executable] Code injected.');
  fs.renameSync(path.join(process.env.TEMP || '', 'app.exe'), path.join(path.dirname(buildDir), 'app.exe'));
  console.log(`[Program] You can close the program, "app.exe" has been created in: "${buildDir}".`);

  fs.rmSync(buildDir, { recursive: true, force: true });
  console.log(`[Clean Up] The build directory has been removed.`);
};

const checkAndInstallPackage = async (packageName: string): Promise<void> => {
  const exists = fs.existsSync(path.join(process.env.APPDATA || '', 'npm', packageName));
  if (!exists) {
    await commandExecutor.executeCommand(`npm install ${packageName} -g`);
  }
};

const installDependencies = async (): Promise<void> => {
  console.clear();
  console.log('Installing dependencies, please wait...');

  await checkAndInstallPackage('npm');
  await checkAndInstallPackage('postject');
  await checkAndInstallPackage('esbuild');

  await getProjectDirectory();
};

installDependencies().catch((error) => {
  console.log(`[Error] ${error.message}`);
});