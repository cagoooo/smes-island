import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

// 用提交時間與雜湊當版本：可比新舊，同一提交重跑部署也不變，不會誤報新版
function buildVersion() {
  try {
    const [time, hash] = execSync('git log -1 --format=%ct,%h --abbrev=7', { encoding: 'utf8' }).trim().split(',');
    const at = new Date(Number(time) * 1000).toISOString().slice(0, 16).replace(/\D/g, '');
    return `${at}-${hash}`;
  } catch {
    return 'dev';
  }
}

const BUILD = buildVersion();

function serviceWorker() {
  return {
    name: 'smes-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle).filter((f) => f.startsWith('assets/')).map((f) => `./${f}`);
      const source = readFileSync('src/sw.js', 'utf8')
        .replace("'__BUILD__'", JSON.stringify(BUILD))
        .replace("'__VERSION__'", JSON.stringify(pkg.version))
        .replace("'__NOTES__'", JSON.stringify(pkg.releaseNotes))
        .replace("'__ASSETS__'", JSON.stringify(assets));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_VERSION__: JSON.stringify(BUILD),
  },
  plugins: [serviceWorker()],
});
