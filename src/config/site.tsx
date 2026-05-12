import {
  LuActivity,
  LuFileText,
  LuFolderOpen,
  LuInfo,
  LuLayoutDashboard,
  LuSettings,
  LuSignal,
  LuTerminal,
  LuZap,
  LuPackage,
  LuStore,
  LuPuzzle,
  LuScrollText,
} from 'react-icons/lu';

export type SiteConfig = typeof siteConfig;
export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  autoOpen?: boolean;
  href?: string;
  items?: MenuItem[];
  customIcon?: string;
}

export const siteConfig = {
  name: 'DDNet Panel',
  description: 'mop server 管理面板',
  navItems: [
    { label: '仪表盘', icon: <LuLayoutDashboard className='w-5 h-5' />, href: '/' },
    { label: '地图管理', icon: <LuFolderOpen className='w-5 h-5' />, href: '/maps' },
    { label: '地图商店', icon: <LuStore className='w-5 h-5' />, href: '/store' },
    { label: '控制台', icon: <LuTerminal className='w-5 h-5' />, href: '/console' },
    { label: '面板日志', icon: <LuScrollText className='w-5 h-5' />, href: '/log' },
  ] as MenuItem[],
  links: {
    github: 'https://github.com/ddnet/ddnet',
    docs: 'https://ddnet.org/',
  },
};
