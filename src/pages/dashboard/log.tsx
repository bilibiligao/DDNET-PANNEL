import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardBody } from '@heroui/card';
import { Button } from '@heroui/button';
import { Chip } from '@heroui/chip';
import { title } from '@/components/primitives';
import client from '@/api/client';
import { LuRefreshCw, LuScrollText } from 'react-icons/lu';

export default function LogPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get('/panel/logs?lines=300');
      setLogs(data.logs || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  return (
    <section className='w-full md:max-w-[1000px] mx-auto space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className={title({ color: 'pink', size: 'xs' })}>面板日志</h2>
          <p className='text-default-400 text-sm mt-1'>DDNet 面板服务运行日志</p>
        </div>
        <div className='flex items-center gap-2'>
          <Chip size='sm' variant='flat' color='primary'>{logs.length} 行</Chip>
          <Button isIconOnly color='primary' variant='flat' radius='full' size='sm'
            isLoading={loading} onPress={fetchLogs}>
            <LuRefreshCw size={14} />
          </Button>
        </div>
      </div>

      <Card className='backdrop-blur-sm border border-white/40 dark:border-white/10 shadow-sm rounded-2xl bg-white/60 dark:bg-black/40 overflow-hidden' shadow='none'>
        <div className='flex flex-row items-center gap-2 px-4 py-2'>
          <LuScrollText className='text-primary/70' size={14} />
          <span className='text-xs text-default-400'>journalctl -u ddnet-panel</span>
        </div>
        <CardBody className='p-0'>
          <div ref={containerRef} onScroll={handleScroll}
            className='h-[500px] md:h-[calc(100vh-14rem)] overflow-y-auto rounded-b-2xl bg-white/20 dark:bg-black/20 font-mono text-xs p-4'>
            {loading && logs.length === 0 ? (
              <p className='text-default-400 text-center py-8'>加载中...</p>
            ) : logs.length === 0 ? (
              <p className='text-default-400 text-center py-8'>无日志</p>
            ) : (
              logs.map((line, i) => {
                // Color-code log lines by severity
                let color = 'text-default-600 dark:text-gray-400';
                if (line.includes('[error]') || line.includes('ERROR') || line.includes('失败'))
                  color = 'text-danger-500 dark:text-danger-400';
                else if (line.includes('[download]'))
                  color = 'text-primary-500 dark:text-primary-400';
                else if (line.includes('[WS]'))
                  color = 'text-success-500 dark:text-success-400';
                else if (line.includes('running on') || line.includes('DDNet Panel'))
                  color = 'text-success-600 dark:text-success-400 font-bold';

                return (
                  <div key={i} className={`${color} leading-5 hover:bg-default-100/30 px-1 rounded`}>
                    {line}
                  </div>
                );
              })
            )}
          </div>
        </CardBody>
      </Card>
    </section>
  );
}
