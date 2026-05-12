import { useState, useEffect, useMemo } from 'react';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Input } from '@heroui/input';
import { Button } from '@heroui/button';
import { Chip } from '@heroui/chip';
import { Tooltip } from '@heroui/tooltip';
import { Pagination } from '@heroui/pagination';
import { LuSearch, LuDownload, LuRss, LuMap, LuHardDrive, LuUser, LuStar, LuImage } from 'react-icons/lu';
import { title } from '@/components/primitives';
import client from '@/api/client';
import toast from 'react-hot-toast';

interface FeedEntry {
  title: string; link: string; date: string; description: string;
  tags: string[]; type: string; difficulty: number; points: number;
  mapper: string; thumbnail: string; width: number; height: number; tiles: string[];
}

const PAGE_SIZE = 48;

const DIFFICULTY_STARS = ['☆☆☆☆☆', '★☆☆☆☆', '★★☆☆☆', '★★★☆☆', '★★★★☆', '★★★★★'];

const TYPE_COLORS: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'secondary' | 'default'> = {
  novice: 'success', moderate: 'primary', brutal: 'danger', insane: 'warning',
  dummy: 'secondary', solo: 'secondary', fun: 'default', race: 'warning',
  oldschool: 'default', event: 'danger',
};

export default function StorePage() {
  const [query, setQuery] = useState('');
  const [allMaps, setAllMaps] = useState<FeedEntry[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedStars, setSelectedStars] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const { data } = await client.get('/feed?all=true');
      setAllMaps(data.items || []);
    } catch { }
    try {
      const { data } = await client.get('/store/tags');
      setTags(data.tags || []);
    } catch { }
    finally { setLoading(false); }
  }

  async function handleDownload(name: string, mapType: string) {
    setDownloading(name);
    try {
      await client.post('/store/download', { name, type: mapType });
      toast.success(`已下载: ${name}`);
    } catch (err: any) { toast.error(err.response?.data?.error || '下载失败'); }
    finally { setDownloading(null); }
  }

  const filtered = useMemo(() => {
    let maps = allMaps;
    if (selectedType) maps = maps.filter((m) => m.type.toLowerCase() === selectedType.toLowerCase());
    if (selectedStars !== null) maps = maps.filter((m) => m.difficulty === selectedStars);
    if (selectedTag) maps = maps.filter((m) => m.tags.some((t) => t.toLowerCase() === selectedTag.toLowerCase()));
    if (query.trim()) {
      const q = query.toLowerCase();
      maps = maps.filter((m) =>
        m.title.toLowerCase().includes(q) ||
        m.mapper.toLowerCase().includes(q) ||
        m.tiles.some((t) => t.toLowerCase().includes(q)) ||
        m.type.toLowerCase().includes(q)
      );
    }
    return maps;
  }, [allMaps, selectedType, selectedStars, selectedTag, query]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedMaps = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [selectedTag, selectedType, selectedStars, query]);

  const serverTypes = useMemo(() => {
    const types = new Map<string, number>();
    for (const m of allMaps) types.set(m.type, (types.get(m.type) || 0) + 1);
    return Array.from(types.entries()).sort((a, b) => b[1] - a[1]);
  }, [allMaps]);

  return (
    <section className='w-full md:max-w-[1100px] mx-auto space-y-4'>
      <div className='flex items-center gap-3'>
        <div>
          <h2 className={title({ color: 'pink', size: 'xs' })}>地图商店</h2>
          <p className='text-default-400 text-sm mt-1'>从 ddnet.org 发现和下载地图</p>
        </div>
        <Chip color='primary' variant='flat' size='sm' className='mt-2'>{filtered.length} 个地图</Chip>
      </div>

      {/* Search bar */}
      <Card className='backdrop-blur-sm border border-white/40 dark:border-white/10 shadow-sm rounded-2xl bg-white/60 dark:bg-black/40' shadow='none'>
        <CardBody className='p-3 flex flex-row gap-2'>
          <Input placeholder='搜索地图名称、作者、特性...' startContent={<LuSearch className='text-default-400' />} value={query} onValueChange={setQuery}
            className='flex-1' size='sm' classNames={{ inputWrapper: 'bg-default-100/50 backdrop-blur-sm' }} />
          <Chip size='sm' variant='flat' color='primary'>{filtered.length} 个结果</Chip>
        </CardBody>
      </Card>

      {/* Server type filter bar */}
      {serverTypes.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          <Chip size='sm' variant={!selectedType ? 'solid' : 'flat'} color='primary'
            className='cursor-pointer transition-all' onClick={() => setSelectedType(null)}>
            全部 {allMaps.length}
          </Chip>
          {serverTypes.map(([t, count]) => (
            <Chip key={t} size='sm' variant={selectedType === t.toLowerCase() ? 'solid' : 'flat'}
              color={TYPE_COLORS[t.toLowerCase()] || 'default'}
              className='cursor-pointer transition-all' onClick={() => setSelectedType(selectedType === t.toLowerCase() ? null : t.toLowerCase())}>
              {t} <span className='ml-1 opacity-60'>{count}</span>
            </Chip>
          ))}
        </div>
      )}

      {/* Difficulty / star filter */}
      <div className='flex flex-wrap gap-1.5'>
        <Chip size='sm' variant={selectedStars === null ? 'solid' : 'flat'} color='warning'
          className='cursor-pointer transition-all' onClick={() => setSelectedStars(null)}>
          全部难度
        </Chip>
        {[0, 1, 2, 3, 4, 5].map((stars) => {
          const count = allMaps.filter((m) => m.difficulty === stars).length;
          return (
            <Chip key={stars} size='sm' variant={selectedStars === stars ? 'solid' : 'flat'} color='warning'
              className='cursor-pointer transition-all' onClick={() => setSelectedStars(selectedStars === stars ? null : stars)}>
              <LuStar size={10} className='inline mr-0.5' />
              {stars === 0 ? 'Unrated' : DIFFICULTY_STARS[stars]}
              <span className='ml-1 opacity-60'>{count}</span>
            </Chip>
          );
        })}
      </div>

      {/* Tile/tag filter bar */}
      {tags.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {tags.filter(t => t.count > 10).slice(0, 25).map(({ tag, count }) => {
            const active = selectedTag === tag.toLowerCase();
            return (
              <Chip key={tag} size='sm' variant={active ? 'solid' : 'flat'} color='primary'
                className='cursor-pointer transition-all' onClick={() => setSelectedTag(active ? null : tag.toLowerCase())}>
                {tag} <span className='ml-1 opacity-60'>{count}</span>
              </Chip>
            );
          })}
        </div>
      )}

      {/* Map cards grid */}
      <div>
        {!query.trim() && !selectedTag && !selectedType && selectedStars === null && <p className='text-sm text-default-400 mb-2'>全部地图 · 第 {page} 页</p>}
        {(selectedTag || selectedType || query.trim() || selectedStars !== null) && (
          <p className='text-sm text-default-400 mb-2'>筛选结果 · {filtered.length} 个地图</p>
        )}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2'>
          {loading ? (
            <p className='text-sm text-default-400 col-span-full py-8 text-center'>加载中...</p>
          ) : pagedMaps.length === 0 ? (
            <div className='col-span-full py-8 text-center text-default-400'>
              <LuRss size={32} className='mx-auto mb-2' /><p className='text-sm'>无匹配结果</p>
            </div>
          ) : (
            pagedMaps.map((m) => (
              <MapCard key={m.title} item={m} downloading={downloading} onDownload={handleDownload} />
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className='flex justify-center pt-2'>
          <Pagination total={totalPages} page={page} onChange={setPage} size='sm' showControls
            classNames={{ cursor: 'bg-primary' }} />
        </div>
      )}
    </section>
  );
}

function MapCard({ item, downloading, onDownload }: { item: FeedEntry; downloading: string | null; onDownload: (name: string, type: string) => void }) {
  const typeColor = TYPE_COLORS[item.type.toLowerCase()] || 'default';

  return (
    <Card className='backdrop-blur-sm border border-white/40 dark:border-white/10 shadow-sm rounded-2xl bg-white/60 dark:bg-black/40 transition-all hover:bg-white/70 dark:hover:bg-black/30 group' shadow='none'>
      <CardHeader className='pb-0 pt-0 px-0 rounded-t-2xl overflow-hidden h-32 bg-default-100/50'>
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.title} className='w-full h-full object-cover' loading='lazy'
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className='w-full h-full flex items-center justify-center text-default-300'>
            <LuImage size={40} />
          </div>
        )}
      </CardHeader>
      <div className='px-3 pt-2 pb-1 flex flex-col gap-1.5'>
        {/* Title */}
        <Tooltip content={item.title}>
          <p className='font-medium text-sm truncate'>{item.title}</p>
        </Tooltip>

        {/* Type + Difficulty + Points */}
        <div className='flex items-center gap-1.5 flex-wrap'>
          <Chip size='sm' variant='flat' color={typeColor} className='h-5 text-[10px]'>{item.type}</Chip>
          <Chip size='sm' variant='flat' className='h-5 text-[10px]'>{DIFFICULTY_STARS[item.difficulty] || '?'}</Chip>
          {item.points > 0 && (
            <Chip size='sm' variant='flat' color='warning' className='h-5 text-[10px]'>{item.points} pts</Chip>
          )}
        </div>

        {/* Tiles used */}
        {item.tiles.length > 0 && (
          <div className='flex items-center gap-1 flex-wrap'>
            {item.tiles.slice(0, 5).map((t) => (
              <span key={t} className='text-[10px] text-default-400 bg-default-100/50 px-1.5 py-0.5 rounded'>{t.replace(/_/g, ' ')}</span>
            ))}
            {item.tiles.length > 5 && (
              <span className='text-[10px] text-default-400'>+{item.tiles.length - 5}</span>
            )}
          </div>
        )}

        {/* Mapper + Date + Size */}
        <div className='flex items-center gap-2 text-tiny text-default-400 mb-1 flex-wrap'>
          <span className='flex items-center gap-0.5'><LuUser size={10} />{item.mapper}</span>
          <span className='flex items-center gap-0.5'><LuHardDrive size={10} />{item.width}x{item.height}</span>
          <span>{item.date?.slice(0, 10) || ''}</span>
        </div>

        {/* Download button */}
        <Button color='primary' variant='flat' size='sm' radius='full' className='w-full mt-auto'
          isLoading={downloading === item.title}
          onPress={() => onDownload(item.title, item.type)}
          startContent={!downloading ? <LuDownload size={14} /> : undefined}>
          下载地图
        </Button>
      </div>
    </Card>
  );
}
