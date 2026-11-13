import test from 'node:test';
import assert from 'node:assert/strict';
import { WaMeSender } from '../public/js/core/sender.js';

test('WaMeSender abre o link do WhatsApp da aluna', async () => {
  const abertos = [];
  const sender = new WaMeSender((url) => abertos.push(url));
  await sender.enviar({ telefone: '5511912345678' }, 'Oi');
  assert.deepEqual(abertos, ['https://wa.me/5511912345678?text=Oi']);
});
