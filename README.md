# Gree AC Controller

Painel local para **ver o estado real e controlar um ar-condicionado Gree com Wi-Fi** direto do computador, sem passar pela nuvem da Gree.

## Por que existe

- O controle remoto é infravermelho e só **envia** comandos: ele nunca sabe o que o aparelho está fazendo de fato, então mostra sempre a última configuração que ele mesmo mandou.
- O app da Gree passa pela nuvem, o que causa atraso e quedas de conexão quando o celular está ocioso ou com a tela bloqueada.
- Os splits Gree com Wi-Fi aceitam comandos **UDP na porta 7000 da rede local**. Este projeto fala direto com o aparelho por esse caminho: resposta rápida e estado em tempo real, inclusive quando alguém mexe no controle ou no app.

## Como funciona

```
Navegador (public/index.html)
   │  HTTP + Server-Sent Events (localhost:3000)
   ▼
Servidor Node/TypeScript (src/server.ts)
   │  src/device.ts: estado, validação e comandos
   │  biblioteca gree-hvac-client: UDP + criptografia AES
   ▼
Ar-condicionado Gree (UDP :7000, mesma rede local)
```

O navegador não consegue falar UDP, então o servidor local faz a ponte. Ele consulta o aparelho a cada poucos segundos e envia as mudanças ao painel por SSE.

| Endpoint | Descrição |
|---|---|
| `GET /api/status` | Estado atual (conexão, última atualização, propriedades) |
| `GET /api/events` | Stream SSE com o estado, atualizado em tempo real |
| `GET /api/options` | Valores aceitos para cada propriedade |
| `POST /api/set` | Altera propriedades, ex.: `{"power":"on","temperature":23}` |

Propriedades que podem ser alteradas: `power`, `mode`, `temperature` (16 a 30 °C), `fanSpeed`, `swingVert`, `swingHor`, `turbo`, `quiet`, `sleep`, `lights`, `health`, `powerSave`, `blow`. Nem todo modelo suporta todas. O painel esconde os extras que o seu aparelho não reporta.

## Requisitos

- Node.js 18 ou superior
- O computador na **mesma rede e sub-rede** do ar-condicionado (broadcast UDP não atravessa VLAN nem rede de convidados)
- Um **IP fixo** para o ar-condicionado (reserva de DHCP no roteador)

## Instalação

```bash
git clone <url-do-seu-repositorio>
cd gree-ac-controller
npm install
```

## Uso

1. Descubra o IP do aparelho:

   ```bash
   npm run discover
   ```

2. Configure e inicie:

   ```bash
   cp .env.example .env      # edite GREE_HOST com o IP encontrado
   GREE_HOST=192.168.1.50 npm run dev
   ```

3. Abra <http://localhost:3000>.

Para rodar compilado: `npm run build && GREE_HOST=192.168.1.50 npm start`.

### Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `GREE_HOST` | (obrigatória) | IP do ar-condicionado |
| `PORT` | `3000` | Porta do painel |
| `BIND` | `127.0.0.1` | Endereço de escuta. Use `0.0.0.0` para acessar de outros dispositivos da rede |
| `POLL_INTERVAL` | `3000` | Intervalo de leitura do status, em ms |

> O Node não carrega `.env` sozinho. Exporte as variáveis no terminal, ou use `node --env-file=.env dist/server.js` (Node 20.6+).

## Segurança

O painel **não tem autenticação**. Por padrão ele escuta só em `127.0.0.1`. Se usar `BIND=0.0.0.0`, qualquer pessoa na sua rede poderá controlar o aparelho. Nesse caso, coloque atrás de um proxy com senha ou restrinja por firewall.

## Solução de problemas

- **Fica em "Conectando…"**: confirme o IP, que o PC está na mesma sub-rede e que nenhum firewall bloqueia UDP na porta 7000. Rodar `npm run discover` ajuda a confirmar se o aparelho responde.
- **"Sem resposta do aparelho"**: o ar-condicionado parou de responder (Wi-Fi fraco, IP mudou). O cliente tenta reconectar sozinho.
- **O Wi-Fi do aparelho precisa ser configurado de novo**: veja as instruções de modo AP no README da biblioteca [`gree-hvac-client`](https://github.com/inwaar/gree-hvac-client).
- **A temperatura do ambiente não aparece**: alguns modelos não têm esse sensor ou não o expõem.

## Ideias para evoluir

- Widget de bandeja com Tauri ou Electron apontando para o painel
- Histórico de temperatura e uso (SQLite) e gráficos
- Agendamentos e automações (ex.: desligar ao fim do expediente)
- Integração com Home Assistant ou MQTT
- Autenticação básica para uso na rede local

## Licença e créditos

Usa a biblioteca [`gree-hvac-client`](https://github.com/inwaar/gree-hvac-client), licenciada sob **GPL-3.0**. Verifique as implicações da GPL antes de escolher a licença do seu repositório ou de distribuir este projeto. Este projeto não tem relação com a Gree Electric Appliances.
