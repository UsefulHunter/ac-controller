import dgram from 'dgram';
import os from 'os';

/** Calcula o endereço de broadcast de cada interface IPv4 (ex.: 192.168.1.255). */
function broadcastAddresses(): string[] {
  const out = new Set<string>(['255.255.255.255']);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family !== 'IPv4' || i.internal) continue;
      const ip = i.address.split('.').map(Number);
      const mask = i.netmask.split('.').map(Number);
      out.add(ip.map((b, n) => (b | (~mask[n] & 255))).join('.'));
    }
  }
  return [...out];
}

const socket = dgram.createSocket('udp4');
const found = new Map<string, string>();

socket.on('message', (msg, rinfo) => {
  try {
    const data = JSON.parse(msg.toString());
    if (data.t === 'dev' || data.cid) found.set(rinfo.address, data.cid ?? data.mac ?? '?');
    else found.set(rinfo.address, '?');
  } catch {
    // ignora respostas que não são JSON
  }
});

socket.bind(() => {
  socket.setBroadcast(true);
  const probe = Buffer.from(JSON.stringify({ t: 'scan' }));
  for (const addr of broadcastAddresses()) socket.send(probe, 7000, addr);
  console.log('Procurando aparelhos Gree na rede (4s)...');
  setTimeout(() => {
    socket.close();
    if (found.size === 0) {
      console.log('Nenhum aparelho respondeu. Verifique se o PC está na mesma sub-rede/VLAN do ar-condicionado.');
    } else {
      for (const [ip, id] of found) console.log(`Encontrado: ${ip}  (id ${id})`);
      console.log('\nUse o IP em GREE_HOST, por exemplo: GREE_HOST=' + [...found.keys()][0] + ' npm run dev');
    }
  }, 4000);
});
