import { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Button } from '@heroui/button';
import { Chip } from '@heroui/chip';
import { Tooltip } from '@heroui/tooltip';
import { LuServer, LuUsers, LuCpu, LuPlay, LuSquare, LuRotateCw, LuMonitor } from 'react-icons/lu';
import { title } from '@/components/primitives';
import client from '@/api/client';
import toast from 'react-hot-toast';
import SystemStatusDisplay from '@/components/system_status_display';

interface ServerStatus {
  rconConnected: boolean; ddnetRunning: boolean; serverName: string;
  port: number; players: number; uptime: string;
}

interface PanelSystemStatus {
  cpu: { core: number; model: string; speed: string; usage: { system: string; qq: string } };
  memory: { total: string; usage: { system: string; qq: string } };
  arch: string;
  panelMem?: number;
  panelCpu?: number;
}

export default function DashboardIndexPage() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [sysStatus, setSysStatus] = useState<PanelSystemStatus | null>(null);

  useEffect(() => {
    fetchStatus();
    const i = setInterval(fetchStatus, 10000);
    return () => clearInterval(i);
  }, []);

  async function fetchStatus() {
    try { const { data } = await client.get('/server/status'); setStatus(data); } catch {}
    try { const { data } = await client.get('/system/status'); setSysStatus(data); } catch {}
  }

  async function serverAction(action: string) {
    try {
      await client.post(`/server/${action}`);
      toast.success(action === 'start' ? 'DDNet 已启动' : action === 'stop' ? 'DDNet 已停止' : 'DDNet 已重启');
      setTimeout(fetchStatus, 2000); // Wait a bit then refresh
    } catch (err: any) {
      toast.error(err.response?.data?.error || '操作失败');
    }
  }

  return (
    <section className='w-full md:max-w-[1000px] mx-auto space-y-4'>
      <div className='flex items-center gap-3'>
        <div>
          <h2 className={title({ color: 'pink', size: 'xs' })}>仪表盘</h2>
          <p className='text-default-400 text-sm mt-1'>mop server 运行状态</p>
        </div>
        <Chip color={status?.ddnetRunning ? 'success' : 'danger'} variant='flat' size='sm' className='mt-2'>
          {status?.ddnetRunning ? 'DDNet 运行中' : 'DDNet 已停止'}
        </Chip>
        <div className='flex items-center gap-1 mt-2 ml-auto'>
          {status?.ddnetRunning ? (
            <>
              <Button isIconOnly color='warning' variant='flat' radius='full' size='sm' onPress={() => serverAction('restart')}>
                <LuRotateCw size={14} />
              </Button>
              <Button isIconOnly color='danger' variant='flat' radius='full' size='sm' onPress={() => serverAction('stop')}>
                <LuSquare size={14} />
              </Button>
            </>
          ) : (
            <Button isIconOnly color='success' variant='flat' radius='full' size='sm' onPress={() => serverAction('start')}>
              <LuPlay size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Stat cards — using NapCat NetworkItemDisplay pattern */}
      <div className='grid grid-cols-1 sm:grid-cols-4 gap-2'>
        <Card className='backdrop-blur-sm border border-white/40 dark:border-white/10 shadow-sm rounded-2xl bg-white/60 dark:bg-black/40 sm:col-span-2 transition-all hover:bg-white/70 dark:hover:bg-black/30' shadow='none'>
          <CardBody className='items-center sm:gap-1 p-2'>
            <Tooltip content={`DDNet 进程: ${status?.ddnetRunning ? '运行中' : '已停止'}`}>
              <p className='flex-1 font-mono font-bold text-4xl sm:text-5xl text-default-700 dark:text-gray-200'>
                {status?.ddnetRunning ? 'ON' : 'OFF'}
              </p>
            </Tooltip>
            <p className='whitespace-nowrap text-nowrap flex-shrink-0 font-medium text-sm text-default-500'>
              <LuServer className='inline mr-1' size={14} />服务器
            </p>
          </CardBody>
        </Card>
        <Card className='backdrop-blur-sm border border-white/40 dark:border-white/10 shadow-sm rounded-2xl bg-white/60 dark:bg-black/40 sm:col-span-1 transition-all hover:bg-white/70 dark:hover:bg-black/30' shadow='none'>
          <CardBody className='items-center sm:gap-1 p-2'>
            <Tooltip content={`当前在线玩家: ${status?.players ?? 0}`}>
              <p className='flex-1 font-mono font-bold text-2xl sm:text-3xl text-default-700 dark:text-gray-200'>
                {status?.players ?? '-'}
              </p>
            </Tooltip>
            <p className='whitespace-nowrap text-nowrap flex-shrink-0 font-medium text-xs text-default-500'>
              <LuUsers className='inline mr-1' size={12} />玩家
            </p>
          </CardBody>
        </Card>
        <Card className='backdrop-blur-sm border border-white/40 dark:border-white/10 shadow-sm rounded-2xl bg-white/60 dark:bg-black/40 sm:col-span-1 transition-all hover:bg-white/70 dark:hover:bg-black/30' shadow='none'>
          <CardBody className='items-center sm:gap-1 p-2'>
            <Tooltip content={`运行时长: ${status?.uptime || '-'}`}>
              <p className='flex-1 font-mono font-bold text-2xl sm:text-3xl text-default-700 dark:text-gray-200'>
                {status?.uptime || '-'}
              </p>
            </Tooltip>
            <p className='whitespace-nowrap text-nowrap flex-shrink-0 font-medium text-xs text-default-500'>
              <LuCpu className='inline mr-1' size={12} />运行
            </p>
          </CardBody>
        </Card>
      </div>

      {/* System status — reuse NapCat's SystemStatusDisplay directly */}
      {sysStatus && (
        <SystemStatusDisplay data={sysStatus as any} processName="DDNet" />
      )}

      {/* Panel resource card */}
      {sysStatus?.panelMem != null && (
        <Card className='backdrop-blur-sm border border-white/40 dark:border-white/10 shadow-sm rounded-2xl bg-white/60 dark:bg-black/40' shadow='none'>
          <CardHeader className='pb-0'><h3 className='text-primary/80 font-semibold text-sm flex items-center gap-1'><LuMonitor size={14} />面板资源</h3></CardHeader>
          <CardBody className='p-3'>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
              <div className='text-center p-2 rounded-lg bg-content2/30'>
                <p className='text-lg font-mono font-bold text-primary'>{sysStatus.panelMem} MB</p>
                <p className='text-tiny text-default-400'>内存占用</p>
              </div>
              <div className='text-center p-2 rounded-lg bg-content2/30'>
                <p className='text-lg font-mono font-bold text-primary'>{sysStatus.panelCpu ?? '-'}%</p>
                <p className='text-tiny text-default-400'>CPU 使用</p>
              </div>
              <div className='text-center p-2 rounded-lg bg-content2/30'>
                <p className='text-lg font-mono font-bold text-success'>{sysStatus.memory.usage.qq} MB</p>
                <p className='text-tiny text-default-400'>DDNet 内存</p>
              </div>
              <div className='text-center p-2 rounded-lg bg-content2/30'>
                <p className='text-lg font-mono font-bold text-success'>{sysStatus.cpu.usage.qq}%</p>
                <p className='text-tiny text-default-400'>DDNet CPU</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Server info */}
      <Card className='backdrop-blur-sm border border-white/40 dark:border-white/10 shadow-sm rounded-2xl bg-white/60 dark:bg-black/40' shadow='none'>
        <CardHeader className='pb-0'><h3 className='text-primary/80 font-semibold text-sm'>服务器信息</h3></CardHeader>
        <CardBody className='flex flex-col gap-1 pt-2'>
          <div className='shadow-sm p-2 rounded-md text-sm bg-content1/30'>
            <span className='text-default-400'>名称: </span>
            <span className='font-mono font-bold'>{status?.serverName || 'mop server'}</span>
          </div>
          <div className='shadow-sm p-2 rounded-md text-sm bg-content1/30'>
            <span className='text-default-400'>端口: </span>
            <span className='font-mono'>{status?.port || 8303}</span>
            <span className='text-default-400 ml-4'>RCON: </span>
            <span className='font-mono'>{status?.rconConnected ? '已连接' : '未连接'}</span>
          </div>
        </CardBody>
      </Card>
    </section>
  );
}
