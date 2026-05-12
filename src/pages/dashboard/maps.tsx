import { useEffect, useState } from 'react';
import { Card, CardBody } from '@heroui/card';
import { Input } from '@heroui/input';
import { Switch } from '@heroui/switch';
import { Button } from '@heroui/button';
import { Chip } from '@heroui/chip';
import { Tooltip } from '@heroui/tooltip';
import { LuSearch, LuTrash2, LuMap, LuHardDrive, LuUser, LuStar } from 'react-icons/lu';
import { title } from '@/components/primitives';
import client from '@/api/client';
import toast from 'react-hot-toast';

interface MapInfo {
  name: string; size: number; enabled: boolean; modified: string;
  meta?: { title: string; type: string; difficulty: number; points: number; mapper: string; tiles: string[]; width: number; height: number; thumbnail: string } | null;
}

const DIFFICULTY_STARS = ['☆☆☆☆☆', '★☆☆☆☆', '★★☆☆☆', '★★★☆☆', '★★★★☆', '★★★★★'];
const TYPE_COLORS: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'secondary' | 'default'> = {
  novice: 'success', moderate: 'primary', brutal: 'danger', insane: 'warning',
  dummy: 'secondary', solo: 'secondary', fun: 'default', race: 'warning',
  oldschool: 'default', event: 'danger',
};

export default function MapsPage() {
  const [allMaps, setAllMaps] = useState<MapInfo[]>([]);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedStars, setSelectedStars] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchMaps(); }, []);

  async function fetchMaps() {
    setLoading(true);
    try {
      const { data } = await client.get('/maps');
      setAllMaps(data.maps);
    } catch {} finally { setLoading(false); }
  }

  // Client-side filtering
  const maps = allMaps.filter((m) => {
    if (selectedType && m.meta?.type.toLowerCase() !== selectedType.toLowerCase()) return false;
    if (selectedStars !== null && m.meta?.difficulty !== selectedStars) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !m.meta?.mapper?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const types = [...new Set(allMaps.filter((m) => m.meta).map((m) => m.meta!.type))].sort();

  async function toggleMap(name: string, enabled: boolean) {
    try {
      await client.patch(`/maps/${encodeURIComponent(name)}`, { enabled: !enabled });
      fetchMaps();
      toast.success(enabled ? '已禁用' : '已启用');
    } catch { toast.error('操作失败'); }
  }

  async function deleteMap(name: string) {
    try {
      await client.delete(`/maps/${encodeURIComponent(name)}`);
      fetchMaps();
      toast.success('已删除');
    } catch { toast.error('删除失败'); }
  }

  return (
    <section className='w-full md:max-w-[1000px] mx-auto space-y-4'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
        <div>
          <h2 className={title({ color: 'pink', size: 'xs' })}>地图管理</h2>
          <p className='text-default-400 text-sm mt-1'>{maps.length} 个地图</p>
        </div>
        <Input placeholder='搜索地图...' startContent={<LuSearch className='text-default-400' />} value={search} onValueChange={setSearch}
          className='sm:w-64' size='sm' classNames={{ inputWrapper: 'bg-default-100/50 backdrop-blur-sm' }} />
      </div>

      {/* Filter bars */}
      <div className='space-y-2'>
        {types.length > 0 && (
          <div className='flex flex-wrap gap-1.5'>
            <Chip size='sm' variant={!selectedType ? 'solid' : 'flat'} color='primary'
              className='cursor-pointer transition-all' onClick={() => setSelectedType(null)}>
              全部 {allMaps.length}
            </Chip>
            {types.map((t) => {
              const count = allMaps.filter((m) => m.meta?.type === t).length;
              return (
                <Chip key={t} size='sm' variant={selectedType === t.toLowerCase() ? 'solid' : 'flat'}
                  color={TYPE_COLORS[t.toLowerCase()] || 'default'}
                  className='cursor-pointer transition-all' onClick={() => setSelectedType(selectedType === t.toLowerCase() ? null : t.toLowerCase())}>
                  {t} <span className='ml-1 opacity-60'>{count}</span>
                </Chip>
              );
            })}
          </div>
        )}
        <div className='flex flex-wrap gap-1.5'>
          <Chip size='sm' variant={selectedStars === null ? 'solid' : 'flat'} color='warning'
            className='cursor-pointer transition-all' onClick={() => setSelectedStars(null)}>
            全部难度
          </Chip>
          {[1, 2, 3, 4, 5].map((stars) => {
            const count = allMaps.filter((m) => m.meta?.difficulty === stars).length;
            return (
              <Chip key={stars} size='sm' variant={selectedStars === stars ? 'solid' : 'flat'} color='warning'
                className='cursor-pointer transition-all' onClick={() => setSelectedStars(selectedStars === stars ? null : stars)}>
                <LuStar size={10} className='inline mr-0.5' />
                {DIFFICULTY_STARS[stars]}
                <span className='ml-1 opacity-60'>{count}</span>
              </Chip>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className='py-8 text-center text-default-400 text-sm'>加载中...</div>
      ) : maps.length === 0 ? (
        <div className='py-8 text-center text-default-400'>
          <LuMap size={32} className='mx-auto mb-2' /><p className='text-sm'>暂无地图，去地图商店下载吧</p>
        </div>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2'>
          {maps.map((m) => (
            <MapCard key={m.name} map={m} onToggle={toggleMap} onDelete={deleteMap} />
          ))}
        </div>
      )}
    </section>
  );
}

function MapCard({ map, onToggle, onDelete }: { map: MapInfo; onToggle: (name: string, enabled: boolean) => void; onDelete: (name: string) => void }) {
  const meta = map.meta;
  const typeColor = meta ? (TYPE_COLORS[meta.type.toLowerCase()] || 'default') : 'default';

  return (
    <Card className='backdrop-blur-sm border border-white/40 dark:border-white/10 shadow-sm rounded-2xl bg-white/60 dark:bg-black/40 transition-all hover:bg-white/70 dark:hover:bg-black/30 group' shadow='none'>
      {/* Thumbnail */}
      <div className='rounded-t-2xl overflow-hidden h-28 bg-default-100/50'>
        {meta?.thumbnail ? (
          <img src={meta.thumbnail} alt={map.name} className='w-full h-full object-cover' loading='lazy'
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className='w-full h-full flex items-center justify-center text-default-300'>
            <LuMap size={36} />
          </div>
        )}
      </div>

      <div className='px-3 pt-2 pb-2 flex flex-col gap-1.5'>
        {/* Name */}
        <Tooltip content={map.name}>
          <p className='font-medium text-sm truncate'>{map.name}</p>
        </Tooltip>

        {/* Metadata row */}
        {meta ? (
          <>
            <div className='flex items-center gap-1.5 flex-wrap'>
              <Chip size='sm' variant='flat' color={typeColor} className='h-5 text-[10px]'>{meta.type}</Chip>
              <Chip size='sm' variant='flat' className='h-5 text-[10px]'>{DIFFICULTY_STARS[meta.difficulty] || '?'}</Chip>
              {meta.points > 0 && (
                <Chip size='sm' variant='flat' color='warning' className='h-5 text-[10px]'>{meta.points} pts</Chip>
              )}
            </div>
            {meta.tiles.length > 0 && (
              <div className='flex items-center gap-1 flex-wrap'>
                {meta.tiles.slice(0, 4).map((t) => (
                  <span key={t} className='text-[10px] text-default-400 bg-default-100/50 px-1.5 py-0.5 rounded'>{t.replace(/_/g, ' ')}</span>
                ))}
              </div>
            )}
            <div className='flex items-center gap-2 text-tiny text-default-400 flex-wrap'>
              <span className='flex items-center gap-0.5'><LuUser size={10} />{meta.mapper}</span>
              <span className='flex items-center gap-0.5'><LuHardDrive size={10} />{meta.width}x{meta.height}</span>
            </div>
          </>
        ) : (
          <div className='flex items-center gap-2 text-tiny text-default-400 flex-wrap'>
            <span className='flex items-center gap-0.5'><LuHardDrive size={10} />{map.size > 1024 * 1024 ? `${(map.size / 1024 / 1024).toFixed(1)} MB` : `${(map.size / 1024).toFixed(0)} KB`}</span>
          </div>
        )}

        {/* Status + Actions */}
        <div className='flex items-center justify-between mt-1'>
          <Chip size='sm' variant='flat' color={map.enabled ? 'success' : 'default'} className='h-5 text-[10px]'>{map.enabled ? '已启用' : '已禁用'}</Chip>
          <div className='flex items-center gap-1'>
            <Switch size='sm' isSelected={map.enabled} onValueChange={() => onToggle(map.name, map.enabled)} />
            <Button isIconOnly variant='light' color='danger' size='sm' radius='full' onPress={() => onDelete(map.name)}><LuTrash2 size={14} /></Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
