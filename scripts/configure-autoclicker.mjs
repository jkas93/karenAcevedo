import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const path = new URL('../.env.local', import.meta.url);
const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
if (/^AUTOCLICKER_PAIRING_SECRET=.+$/m.test(current)) {
  console.log('AUTOCLICKER_PAIRING_SECRET ya está configurado. No se modificó.');
} else {
  writeFileSync(path, current + '\nAUTOCLICKER_PAIRING_SECRET=' + randomBytes(32).toString('hex') + '\n');
  console.log('Se configuró el secreto local de vinculación. Su valor no se imprime ni se agrega a Git.');
}
