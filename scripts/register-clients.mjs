import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function registerClients(home, entry, node = process.execPath) {
  if (!path.isAbsolute(entry) || !fs.existsSync(entry)) throw new Error('Server entry must exist at an absolute path');
  const updates = [];
  function write(file, content) {
    fs.mkdirSync(path.dirname(file), {recursive:true});
    if (fs.existsSync(file)) {
      if (fs.readFileSync(file,'utf8') === content) return;
      fs.copyFileSync(file, file + '.uniprae-' + Date.now() + '.bak');
    }
    fs.writeFileSync(file + '.uniprae-tmp',content,'utf8');
    fs.renameSync(file + '.uniprae-tmp',file);
    updates.push(file);
  }
  const toml = path.join(home,'.codex','config.toml');
  let original = fs.existsSync(toml) ? fs.readFileSync(toml,'utf8') : '';
  // Replace only the exact Uniprae tables. Preserve all unrelated configuration.
  original = original.replace(/^\[mcp_servers\.(?:uniprae|"uniprae")(?:\.[^\]]+)?\][^]*?(?=^\[|$(?![^]))/gm,'');
  // Retire only the identified incompatible Astra connection, retaining its definition.
  original = original.replace(/^\[mcp_servers\.after_effects\][^]*?(?=^\[|$(?![^]))/gm, block => {
    if(!/Astra MCp/i.test(block)) return block;
    return /^enabled\s*=/m.test(block) ? block.replace(/^enabled\s*=.*$/m,'enabled = false') : block+'enabled = false\n';
  });
  const q = value => JSON.stringify(value);
  write(toml, original.trimEnd() + '\n\n[mcp_servers.uniprae]\ncommand = '+q(node)+'\nargs = ['+q(entry)+']\nenabled = true\nstartup_timeout_sec = 30\ntool_timeout_sec = 600\n');
  const destinations = [
    ['.claude.json',true],
    [path.join('.gemini','config','mcp_config.json'),false],
    [path.join('.gemini','antigravity-ide','mcp_config.json'),false],
    [path.join('.gemini','antigravity','mcp_config.json'),false],
  ];
  for(const [relative,claude] of destinations) {
    const file = path.join(home,relative);
    const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')) : {};
    if (data.mcpServers && (Array.isArray(data.mcpServers)||typeof data.mcpServers!=='object')) throw new Error('Invalid mcpServers in '+file);
    data.mcpServers ||= {};
    // Remove known broken Adobe launchers only when their absolute script is absent.
    for (const name of ['aftereffects','premierepro']) {
      const old=data.mcpServers[name];
      const script=old?.args?.[0];
      if(typeof script==='string'&&path.isAbsolute(script)&&!fs.existsSync(script)) delete data.mcpServers[name];
    }
    data.mcpServers.uniprae = {...(claude?{type:'stdio'}:{}),command:node,args:[entry]};
    write(file,JSON.stringify(data,null,2)+'\n');
  }
  return updates;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const entry=process.argv[2];
  console.log(JSON.stringify({updated:registerClients(os.homedir(),entry)},null,2));
}
