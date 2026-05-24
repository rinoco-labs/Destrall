import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Must match vite.main.config.ts rollup externals — installed into the staged app after prune. */
const MAIN_PROCESS_EXTERNAL_PACKAGES = ['node-llama-cpp'] as const;

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
) as { dependencies?: Record<string, string> };

function runNpm(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}

/**
 * Installs only external main-process packages (and their deps) into the staged app.
 * Uses a stub package.json so npm does not pull every production dependency from Destrall.
 */
async function installExternalMainPackages(buildPath: string): Promise<void> {
  const specs = MAIN_PROCESS_EXTERNAL_PACKAGES.map((name) => {
    const version = packageJson.dependencies?.[name];
    return version ? `${name}@${version}` : name;
  });

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'destrall-forge-llm-'));
  try {
    await fs.promises.writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'destrall-forge-llm-stub', private: true }, null, 2),
    );
    await runNpm(['install', '--omit=dev', '--no-package-lock', ...specs], tmpDir);

    const srcModules = path.join(tmpDir, 'node_modules');
    const destModules = path.join(buildPath, 'node_modules');
    await fs.promises.mkdir(destModules, { recursive: true });
    await fs.promises.cp(srcModules, destModules, { recursive: true, force: true });
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

const brandingDir = path.join(__dirname, 'src/assets/branding');
/** Base path without extension — Forge picks .icns / .ico / .png per platform. */
const packagerIcon = path.join(brandingDir, 'desktop-icon');
const linuxIcon = path.join(brandingDir, 'desktop-icon.png');

const linuxPackageOptions = {
  icon: linuxIcon,
  /** Packager emits `Destrall`; deb/rpm default to npm `name` (`destrall`). */
  bin: 'Destrall',
};

// Host-only makers: Squirrel needs Windows (or Mono+Wine on macOS/Linux); deb/rpm need Linux tooling.
// win32 ZIP only when cross-packaging — on Windows, cross-zip uses fs.rmdir({ recursive }) which Node 22+ rejects.
const makers: ForgeConfig['makers'] = [
  new MakerZIP({}, ['darwin']),
  ...(process.platform === 'win32'
    ? [
        new MakerSquirrel({
          setupIcon: path.join(brandingDir, 'desktop-icon.ico'),
          iconUrl: path.join(brandingDir, 'desktop-icon.ico'),
        }),
      ]
    : [new MakerZIP({}, ['win32'])]),
  ...(process.platform === 'linux'
    ? [
        new MakerDeb({ options: linuxPackageOptions }),
        new MakerRpm({ options: linuxPackageOptions }),
      ]
    : []),
  new MakerZIP({}, ['linux']),
];

const config: ForgeConfig = {
  hooks: {
    /**
     * Electron Forge + Vite does not copy node_modules into the packaged app.
     * External main-process packages (see vite.main.config.ts) must be installed here.
     * @see https://node-llama-cpp.withcat.ai/guide/electron
     */
    packageAfterPrune: async (_config, buildPath) => {
      await installExternalMainPackages(buildPath);
    },
  },
  packagerConfig: {
    /** Linux deb/rpm and desktop entries use this binary name (matches productName). */
    executableName: 'Destrall',
    asar: {
      unpack: '**/node_modules/{node-llama-cpp,@node-llama-cpp,llama.cpp}/**/*',
    },
    icon: packagerIcon,
    extraResource: [brandingDir],
  },
  rebuildConfig: {},
  makers,
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/preload-browser-guest.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
