#!/usr/bin/env node
// Launches the SysML v2 MCP server bundled with the VS Code SysML v2 extension
// (JamieD.sysml-v2-support). Picks the newest installed extension version, so
// the MCP config keeps working after the extension updates.
//
// Override with SYSML_MCP_SERVER=<path to mcpServer.js>.

import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function findServer() {
  if (process.env.SYSML_MCP_SERVER) return process.env.SYSML_MCP_SERVER;

  const roots = [
    join(homedir(), '.vscode', 'extensions'),
    join(homedir(), '.vscode-insiders', 'extensions'),
    join(homedir(), '.vscode-server', 'extensions'),
  ];
  const prefix = 'jamied.sysml-v2-support-';
  const candidates = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      if (!name.toLowerCase().startsWith(prefix)) continue;
      const version = name.slice(prefix.length).split('-')[0];
      const server = join(root, name, 'node_modules', 'sysml-v2-lsp', 'dist', 'server', 'mcpServer.js');
      if (existsSync(server)) candidates.push({ version, server });
    }
  }
  candidates.sort((a, b) => compareVersions(b.version, a.version));
  return candidates[0]?.server;
}

const server = findServer();
if (!server) {
  process.stderr.write(
    'sysml-mcp: could not find the SysML v2 extension (JamieD.sysml-v2-support). ' +
      'Install it in VS Code or set SYSML_MCP_SERVER to its mcpServer.js.\n',
  );
  process.exit(1);
}

const child = spawn(process.execPath, [server, ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('exit', (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 0)));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
