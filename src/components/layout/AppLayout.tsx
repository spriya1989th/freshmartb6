'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../store/auth.store';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3, TrendingDown, Users, Truck,
  DollarSign, PieChart, Settings, ChevronDown, ChevronRight, Menu, X, Bell,
  Moon, Sun, LogOut, User, ChevronLeft, Warehouse, Tag, Layers,
} from 'lucide-react';

interface NavItem { label: string; href?: string; icon: React.ReactNode; children?: NavItem[]; permission?: string; badge?: number; }

const NAV: NavItem[] = [
  { label: 'Command Center', href: '/dashboard',    icon: <LayoutDashboard size={18} /> },
  { label: 'QuickSell',      href: '/pos',           icon: <ShoppingCart    size={18} />, badge: 0 },
  { label: 'Catalog Hub',    icon: <Package size={18} />, children: [
    { label: 'Products',    href: '/catalog',             icon: <Package size={15} /> },
    { label: 'Categories',  href: '/catalog/categories',  icon: <Layers  size={15} /> },
    { label: 'Brands',      href: '/catalog/brands',      icon: <Tag     size={15} /> },
    { label: 'Units',       href: '/catalog/units',       icon: <Tag     size={15} /> },
    { label: 'Import',      href: '/catalog/import',      icon: <TrendingDown size={15} /> },
  ]},
  { label: 'StockFlow',      icon: <Warehouse size={18} />, children: [
    { label: 'Stock Overview', href: '/stockflow',          icon: <BarChart3 size={15} /> },
    { label: 'Adjustments',   href: '/stockflow/adjustments', icon: <Settings  size={15} /> },
    { label: 'Transfers',     href: '/stockflow/transfers',   icon: <Truck     size={15} /> },
    { label: 'Expiry Watch',  href: '/stockflow/expiry',      icon: <Bell      size={15} /> },
  ]},
  { label: 'BuyFlow',        icon: <TrendingDown size={18} />, children: [
    { label: 'Purchases',    href: '/buyflow',               icon: <DollarSign size={15} /> },
    { label: 'Receive Stock', href: '/buyflow/receive',      icon: <Package    size={15} /> },
    { label: 'Returns',      href: '/buyflow/returns',       icon: <ChevronLeft size={15} /> },
  ]},
  { label: 'Client Desk',    icon: <Users size={18} />, children: [
    { label: 'Customers',    href: '/client-desk',           icon: <Users size={15} /> },
    { label: 'Credit Accounts', href: '/client-desk/credit', icon: <DollarSign size={15} /> },
  ]},
  { label: 'Vendor Desk',    icon: <Truck size={18} />, children: [
    { label: 'Suppliers',   href: '/vendor-desk',            icon: <Truck size={15} /> },
  ]},
  { label: 'Cash Room',      href: '/cash-room',   icon: <DollarSign size={18} /> },
  { label: 'Insight Lab',    icon: <PieChart size={18} />, children: [
    { label: 'Sales Report',      href: '/insight-lab',              icon: <BarChart3 size={15} /> },
    { label: 'Best Sellers',      href: '/insight-lab/best-selling', icon: <TrendingDown size={15} /> },
    { label: 'Stock Report',      href: '/insight-lab/stock',        icon: <Package  size={15} /> },
    { label: 'P&L Report',        href: '/insight-lab/pnl',          icon: <DollarSign size={15} /> },
    { label: 'Expiry Report',     href: '/insight-lab/expiry',       icon: <Bell     size={15} /> },
    { label: 'Tax Report',        href: '/insight-lab/tax',          icon: <PieChart size={15} /> },
    { label: 'Shift Reports',     href: '/insight-lab/shifts',       icon: <DollarSign size={15} /> },
    { label: 'Customer Ledger',   href: '/insight-lab/customers',    icon: <Users    size={15} /> },
  ]},
  { label: 'Control Room',   href: '/control-room', icon: <Settings size={18} /> },
];

interface AppLayoutProps { children: React.ReactNode; }

export default function AppLayout({ children }: AppLayoutProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [darkMode,    setDarkMode]    = useState(false);
  const [openMenus,   setOpenMenus]   = useState<string[]>([]);
  const [notifications, setNotifs]    = useState(3);

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Auto-open parent menu for current route
  useEffect(() => {
    NAV.forEach(item => {
      if (item.children?.some(c => c.href && pathname.startsWith(c.href))) {
        setOpenMenus(prev => prev.includes(item.label) ? prev : [...prev, item.label]);
      }
    });
  }, [pathname]);

  const toggleMenu = (label: string) =>
    setOpenMenus(prev => prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]);

  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  if (!user) return null;

  return (
    <div className={cn('flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden')}>
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:relative inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-sm">F</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="font-black text-gray-900 dark:text-white text-sm leading-tight">FreshMart</div>
              <div className="text-xs text-gray-400 leading-tight">{user.branch?.name ?? 'Main Branch'}</div>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="ml-auto hidden lg:flex items-center justify-center w-7 h-7 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
          {NAV.map(item => (
            <div key={item.label}>
              {item.href ? (
                <Link href={item.href} onClick={() => setMobileOpen(false)}
                  className={cn('flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors rounded-lg mx-2 my-0.5',
                    isActive(item.href)
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                  )}>
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto bg-emerald-100 text-emerald-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{item.badge}</span>
                  )}
                </Link>
              ) : (
                <>
                  <button onClick={() => !collapsed && toggleMenu(item.label)}
                    className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg mx-2 my-0.5',
                      item.children?.some(c => c.href && isActive(c.href)) ? 'text-emerald-700 dark:text-emerald-400' : ''
                    )}>
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        <ChevronDown size={14} className={cn('transition-transform', openMenus.includes(item.label) ? 'rotate-180' : '')} />
                      </>
                    )}
                  </button>
                  {!collapsed && openMenus.includes(item.label) && (
                    <div className="pl-4">
                      {item.children?.map(child => (
                        <Link key={child.href} href={child.href!} onClick={() => setMobileOpen(false)}
                          className={cn('flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded-lg mx-2 my-0.5',
                            child.href && isActive(child.href)
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium'
                              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                          )}>
                          {child.icon}
                          <span>{child.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </nav>

        {/* User */}
        {!collapsed && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{user.firstName[0]}{user.lastName[0]}</span>
              </div>
              <div className="overflow-hidden flex-1">
                <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.firstName} {user.lastName}</div>
                <div className="text-xs text-gray-400 truncate">{user.role}</div>
              </div>
              <button onClick={logout} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded" title="Logout">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center gap-4 px-4 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <Menu size={20} />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
              <Bell size={20} />
              {notifications > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{notifications}</span>
              )}
            </button>

            {/* Dark mode */}
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* User pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
              <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{user.firstName[0]}</span>
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{user.firstName}</div>
                <div className="text-xs text-gray-400">{user.role}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
