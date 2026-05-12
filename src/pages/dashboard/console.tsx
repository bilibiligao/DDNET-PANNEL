import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardBody } from '@heroui/card';
import { Input } from '@heroui/input';
import { Button } from '@heroui/button';
import { Chip } from '@heroui/chip';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { useTheme } from '@/hooks/use-theme';
import { title } from '@/components/primitives';
import { LuSend, LuTerminal, LuZap, LuRotateCw, LuBan, LuMessageSquare, LuPower } from 'react-icons/lu';

export default function ConsolePage() {
  const termRef = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const token = useSelector((s: RootState) => s.auth?.token ?? localStorage.getItem('ddnet_token'));
  const { isDark } = useTheme();
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!termRef.current || !token) return;
    const fontSize = window.innerWidth < 400 ? 4 : window.innerWidth < 600 ? 5 : window.innerWidth < 900 ? 6 : window.innerWidth < 1280 ? 12 : 16;

    const t = new Terminal({
      cursorBlink: true, cursorInactiveStyle: 'outline', drawBoldTextInBrightColors: false,
      allowTransparency: true, lineHeight: 1.2, fontSize,
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", "JetBrains Mono", monospace',
      theme: isDark ? {
        background: '#00000000', foreground: '#c9d1d9', cursor: '#58a6ff', selectionBackground: '#666',
        black: '#484f58', red: '#ff7b72', green: '#3fb950', yellow: '#d29922',
        blue: '#58a6ff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#b1bac4',
        brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364',
        brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd', brightWhite: '#f0f6fc',
      } : {
        background: '#ffffff00', foreground: '#24292f', cursor: '#0969da', selectionBackground: '#ccc',
        black: '#24292f', red: '#cf222e', green: '#116329', yellow: '#4d2d00',
        blue: '#0969da', magenta: '#8250df', cyan: '#1b7c83', white: '#6e7781',
        brightBlack: '#57606a', brightRed: '#a40e26', brightGreen: '#1a7f37',
        brightYellow: '#633c01', brightBlue: '#218bff', brightMagenta: '#a475f9',
        brightCyan: '#3192aa', brightWhite: '#8c959f',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    t.loadAddon(fitAddon);
    t.loadAddon(new WebLinksAddon());
    t.open(termRef.current);
    fitAddon.fit();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/console?token=${token}`;
    const socket = new WebSocket(wsUrl);
    ws.current = socket;
    socket.onopen = () => setConnected(true);
    socket.onmessage = (e) => t.write(e.data);
    socket.onclose = () => { setConnected(false); t.writeln('\n\x1b[1;33m[断开]\x1b[0m'); };
    socket.onerror = () => t.writeln('\x1b[1;31m[错误]\x1b[0m');

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);
    term.current = t;

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.close(); t.dispose();
    };
  }, [token, isDark]);

  const sendCommand = useCallback((cmd?: string) => {
    const text = (cmd || input).trim();
    if (!text || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    ws.current.send(text);
    term.current?.writeln(`\x1b[1;36m> ${text}\x1b[0m`);
    setInput('');
    inputRef.current?.focus();
  }, [input]);

  const fillInput = (prefix: string) => {
    setInput(prefix);
    inputRef.current?.focus();
  };

  return (
    <section className='w-full md:max-w-[1000px] mx-auto space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className={title({ color: 'pink', size: 'xs' })}>控制台</h2>
          <p className='text-default-400 text-sm mt-1'>DDNet 服务器实时 RCON</p>
        </div>
        <Chip color={connected ? 'success' : 'danger'} variant='flat' size='sm' startContent={<div className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-danger'}`} />}>{connected ? '已连接' : '未连接'}</Chip>
      </div>

      <Card className='backdrop-blur-sm border border-white/40 dark:border-white/10 shadow-sm rounded-2xl bg-white/60 dark:bg-black/40 overflow-hidden' shadow='none'>
        <div className='flex flex-row items-center gap-2 px-4 py-2'>
          <LuTerminal className='text-primary/70' size={14} />
          <span className='text-xs text-default-400'>实时日志输出</span>
        </div>
        <CardBody className='p-0'>
          <div ref={termRef} className='h-[420px] md:h-[calc(100vh-16rem)] rounded-b-2xl overflow-hidden px-2 bg-white/20 dark:bg-black/20' />
        </CardBody>
      </Card>

      {/* Quick command shortcuts */}
      <Card className='backdrop-blur-sm border border-white/40 dark:border-white/10 shadow-sm rounded-2xl bg-white/60 dark:bg-black/40' shadow='none'>
        <CardBody className='p-3 space-y-2.5'>
          {/* Server & Map */}
          <div className='flex items-center gap-1.5 flex-wrap'>
            <span className='text-tiny text-default-400 mr-1 w-14 shrink-0'>服务器</span>
            <Chip size='sm' variant='flat' color='success' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('status')}>status</Chip>
            <Chip size='sm' variant='flat' color='primary' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('reload')}>reload</Chip>
            <Chip size='sm' variant='flat' color='warning' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('restart')}>restart</Chip>
            <Chip size='sm' variant='flat' color='danger' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('shutdown')}>shutdown</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('broadcast ')}>broadcast</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('say ')}>say</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('sv_name ')}>sv_name</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('password ')}>password</Chip>
          </div>
          {/* Map */}
          <div className='flex items-center gap-1.5 flex-wrap'>
            <span className='text-tiny text-default-400 mr-1 w-14 shrink-0'>地图</span>
            <Chip size='sm' variant='flat' color='secondary' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('sv_map ')}>sv_map</Chip>
            <Chip size='sm' variant='flat' color='secondary' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('change_map ')}>change_map</Chip>
            <Chip size='sm' variant='flat' color='secondary' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('random_map')}>random_map</Chip>
            <Chip size='sm' variant='flat' color='secondary' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('random_unfinished_map')}>random_unfinished</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('add_map_votes')}>add_map_votes</Chip>
          </div>
          {/* Players */}
          <div className='flex items-center gap-1.5 flex-wrap'>
            <span className='text-tiny text-default-400 mr-1 w-14 shrink-0'>玩家</span>
            <Chip size='sm' variant='flat' color='primary' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('kick ')}>kick</Chip>
            <Chip size='sm' variant='flat' color='danger' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('ban ')}>ban</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('bans')}>bans</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('unban ')}>unban</Chip>
            <Chip size='sm' variant='flat' color='warning' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('muteid ')}>muteid</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('unmute ')}>unmute</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('force_pause ')}>force_pause</Chip>
            <Chip size='sm' variant='flat' color='danger' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('vote_mute ')}>vote_mute</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('set_team ')}>set_team</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('kill_pl ')}>kill_pl</Chip>
          </div>
          {/* Teleport */}
          <div className='flex items-center gap-1.5 flex-wrap'>
            <span className='text-tiny text-default-400 mr-1 w-14 shrink-0'>传送</span>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('tele ')}>tele</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('totele ')}>totele</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('totelecp ')}>totelecp</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('left')}>left</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('right')}>right</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('up')}>up</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('down')}>down</Chip>
          </div>
          {/* Weapons */}
          <div className='flex items-center gap-1.5 flex-wrap'>
            <span className='text-tiny text-default-400 mr-1 w-14 shrink-0'>道具</span>
            <Chip size='sm' variant='flat' color='success' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('weapons')}>weapons</Chip>
            <Chip size='sm' variant='flat' color='danger' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('unweapons')}>unweapons</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('shotgun')}>shotgun</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('grenade')}>grenade</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('laser')}>laser</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('rifle')}>rifle</Chip>
            <Chip size='sm' variant='flat' color='warning' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('ninja')}>ninja</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('super')}>super</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('jetpack')}>jetpack</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('endless_hook')}>endless_hook</Chip>
          </div>
          {/* Tuning & Special */}
          <div className='flex items-center gap-1.5 flex-wrap'>
            <span className='text-tiny text-default-400 mr-1 w-14 shrink-0'>调参</span>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('tunes')}>tunes</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('tune ')}>tune</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('toggle_tune ')}>toggle_tune</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('tune_reset')}>tune_reset</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('sv_hit ')}>sv_hit</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('sv_team ')}>sv_team</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('sv_pauseable ')}>sv_pauseable</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => fillInput('sv_freeze_delay ')}>sv_freeze_delay</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('solo')}>solo</Chip>
            <Chip size='sm' variant='flat' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('unsolo')}>unsolo</Chip>
            <Chip size='sm' variant='flat' color='primary' className='cursor-pointer hover:opacity-80' onClick={() => sendCommand('freezehammer')}>freezehammer</Chip>
          </div>
        </CardBody>
      </Card>

      <Card className='backdrop-blur-sm border border-white/40 dark:border-white/10 shadow-sm rounded-2xl bg-white/60 dark:bg-black/40' shadow='none'>
        <CardBody className='p-3'>
          <div className='flex gap-2'>
            <Input ref={inputRef} placeholder='输入 RCON 命令，回车发送...' value={input} onValueChange={setInput} onKeyDown={(e) => e.key === 'Enter' && sendCommand()}
              startContent={<span className='text-primary font-mono text-sm'>{'>'}</span>}
              classNames={{ inputWrapper: 'bg-default-100/50 backdrop-blur-sm' }} size='sm' isDisabled={!connected} />
            <Button isIconOnly color='primary' variant='flat' radius='full' size='sm' onPress={() => sendCommand()} isDisabled={!connected || !input.trim()}><LuSend size={14} /></Button>
          </div>
        </CardBody>
      </Card>
    </section>
  );
}
