import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for (const file of readdirSync('src/js').filter(file => file.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', `src/js/${file}`], {stdio: 'inherit'});
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('All application modules passed syntax checks.');
