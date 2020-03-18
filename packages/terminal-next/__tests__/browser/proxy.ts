/**
 * 为了模拟断连而设计的 pty 和 proxy 服务
 */
import * as os from 'os';
import * as pty from 'node-pty';
import * as WebSocket from 'ws';
import * as httpProxy from 'http-proxy';
import { uuid } from '@ali/ide-core-browser';

export const port = 8090;
export let proxyPort = 8091;
export const existPtyProcessId = uuid();
const cache = new Map<string, pty.IPty>();
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

export function localhost(port: number) {
  return `ws://localhost:${port}`;
}

export interface PtyStdOut {
  sessionId: string;
  data: string;
}

export interface PtyStdIn {
  sessionId: string;
  data: string;
}

export interface RPCRequest<T = any> {
  id: string;
  method: string;
  params: T;
}

export interface RPCResponse<T = any> {
  id: string;
  method: string;
  data: T;
}

export enum MessageMethod {
  create = 'create',
  resize = 'resize',
  close = 'close',
}

function _makeResponse(json: RPCRequest, data: any) {
  return {
    id: json.id,
    method: json.method,
    data,
  };
}

export function killPty(json: RPCRequest<{ sessionId: string }>) {
  const { sessionId } = json.params;
  const ptyProcess = cache.get(sessionId);

  if (ptyProcess) {
    ptyProcess.kill();
  }

  return _makeResponse(json, { sessionId });
}

export function createPty(socket: WebSocket, json: RPCRequest<{ sessionId: string, cols: number, rows: number }>): RPCResponse<{ sessionId: string }> {
  const { sessionId, cols, rows } = json.params;

  const ptyProcess = pty.spawn(shell, [], {
    name: shell,
    cols,
    rows,
    cwd: process.env.HOME,
    env: process.env as any,
  });

  ptyProcess.onData((data) => {
    // handleStdOutMessage
    socket.send(JSON.stringify({ sessionId, data } as PtyStdOut));
  });

  ptyProcess.onExit(() => {
    try {
      socket.close();
    } catch { }
  });

  cache.set(sessionId, ptyProcess);
  return _makeResponse(json, { sessionId });
}

export function resizePty(json: RPCRequest<{ sessionId: string, cols: number, rows: number }>) {
  const { sessionId, cols, rows } = json.params;
  const ptyProcess = cache.get(sessionId);

  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
  }
  return _makeResponse(json, { sessionId });
}

export function handleServerMethod(socket: WebSocket, json: RPCRequest): RPCResponse {
  switch (json.method) {
    case MessageMethod.create:
      return createPty(socket, json);
    case MessageMethod.resize:
      return resizePty(json);
    case MessageMethod.close:
      return killPty(json);
    default:
      throw new Error(`Method ${json.method} not supported`);
  }
}

export function handleStdinMessage(json: PtyStdIn) {
  const ptyProcess = cache.get(json.sessionId);
  if (ptyProcess) {
    ptyProcess.write(json.data);
  }
}

export function createWsServer() {
  const server = new WebSocket.Server({ port });

  server.addListener('connection', (socket) => {
    socket.addEventListener('message', (req) => {
      const { data } = req;
      const json = JSON.parse(data.toString());

      if (json.method) {
        const res = handleServerMethod(socket, json);
        socket.send(JSON.stringify(res));
      } else {
        handleStdinMessage(json);
      }
    });
  });

  return server;
}

export function createProxyServer() {
  return httpProxy.createServer({
    target: localhost(port),
    ws: true,
  }).listen(proxyPort++);
}