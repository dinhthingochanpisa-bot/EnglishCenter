'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  AlertCircle,
  Building2,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  GraduationCap,
  Gauge,
  Radio,
  CalendarCheck,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { reportingApi, ExecutiveDashboardData, NotificationItem } from '@/lib/api/reporting';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCenterScope } from '@/providers/CenterScopeProvider';

const DASHBOARD_REFRESH_INTERVAL_MS = parseRefreshInterval(
  process.env.NEXT_PUBLIC_DASHBOARD_REFRESH_MS,
);
const STAGE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

export default function DashboardPage() {
  const { selectedCenterId } = useCenterScope();
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true);
    try {
      setError(null);
      const [dashResult, notifResult] = await Promise.all([
        reportingApi.getExecutive(selectedCenterId),
        reportingApi.getNotifications(selectedCenterId),
      ]);
      setData(dashResult);
      setNotifications(notifResult.items);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError(error instanceof Error ? error.message : 'Không thể tải dữ liệu dashboard');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedCenterId]);

  useEffect(() => {
    fetchData();
    const interval = window.setInterval(() => fetchData(true), DASHBOARD_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  const summary = data?.summary;
  const totalPipeline = useMemo(
    () => data?.leadsByStage.reduce((sum, item) => sum + item.count, 0) || 0,
    [data],
  );

  const handleExportReport = () => {
    if (!data) return;

    const rows = [
      ['Nhóm', 'Chỉ số', 'Giá trị'],
      ['Tổng quan', 'Học sinh đang học', String(summary?.activeStudents || 0)],
      ['Tổng quan', 'Lớp đang active', String(summary?.activeClasses || 0)],
      ['Tổng quan', 'Học sinh refire', String(summary?.refireStudents || 0)],
      ['Tổng quan', 'Học sinh đến hạn tái phí', String(summary?.renewalDueStudents || 0)],
      ['Tổng quan', 'Tổng lead', String(summary?.leadsTotal || 0)],
      ['Tổng quan', 'Hợp đồng mới tháng này', String(summary?.contractsThisMonth || 0)],
      ['Tổng quan', 'Doanh thu tháng này', String(summary?.cashInThisMonth || 0)],
      ['Tổng quan', 'Công nợ hiện tại', String(summary?.totalOutstanding || 0)],
      ['Tổng quan', 'Công suất trung tâm', `${summary?.centerCapacityRate || 0}%`],
      ['Tổng quan', 'Tỷ lệ lấp đầy ca học', `${summary?.scheduleFillRate || 0}%`],
      ['Tổng quan', 'Hợp đồng cần gia hạn', String(summary?.renewalCandidates || 0)],
      ...data.leadsByStage.map((item) => ['Lead theo trạng thái', item.stage, String(item.count)]),
      ...data.monthlyTrend.map((item) => ['Xu hướng tháng', item.month, String(item.cashIn)]),
      ...data.examMonthlyTrend.map((item) => ['Lịch thi theo tháng', item.month, `Thi thật: ${item.realExamStudents}; Mock: ${item.mockTestStudents}`]),
      ...data.centerBreakdown.flatMap((center) => [
        [`Chi nhánh ${center.code}`, 'Tên trung tâm', center.name],
        [`Chi nhánh ${center.code}`, 'Học sinh đang học', String(center.activeStudents)],
        [`Chi nhánh ${center.code}`, 'Hợp đồng đang hoạt động', String(center.activeContracts)],
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bao-cao-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <LoadingState message="Đang chuẩn bị dữ liệu báo cáo..." />;
  }

  const stats = [
    {
      title: 'Học sinh đang học',
      value: formatNumber(summary?.activeStudents || 0),
      icon: Users,
      variant: 'success',
      description: `${formatNumber(summary?.activeClasses || 0)} lớp đang hoạt động`,
    },
    {
      title: 'Lớp active',
      value: formatNumber(summary?.activeClasses || 0),
      icon: GraduationCap,
      variant: 'primary',
      description: `${formatNumber(summary?.activeClassSeatsFilled || 0)}/${formatNumber(summary?.activeClassCapacity || 0)} chỗ đã lấp`,
    },
    {
      title: 'HS refire',
      value: formatNumber(summary?.refireStudents || 0),
      icon: TrendingUp,
      variant: 'warning',
      description: 'Học sinh cần chăm sóc tái phí',
    },
    {
      title: 'Đến hạn tái phí',
      value: formatNumber(summary?.renewalDueStudents || 0),
      icon: Clock,
      variant: 'warning',
      description: `${formatNumber(summary?.renewalCandidates || 0)} hợp đồng hết hạn trong 30 ngày`,
    },
    {
      title: 'Tiềm năng hệ thống',
      value: formatNumber(summary?.leadsTotal || 0),
      icon: Target,
      variant: 'primary',
      description: `${formatNumber(totalPipeline)} lead trong pipeline`,
    },
    {
      title: 'HĐ mới tháng này',
      value: formatNumber(summary?.contractsThisMonth || 0),
      icon: FileText,
      variant: 'info',
      description: `Doanh thu ${formatCurrency(summary?.cashInThisMonth || 0)}`,
    },
    {
      title: 'Doanh thu',
      value: formatCurrency(summary?.cashInThisMonth || 0),
      icon: DollarSign,
      variant: 'info',
      description: 'Dòng tiền đã thu trong tháng',
    },
    {
      title: 'Công nợ',
      value: formatCurrency(summary?.totalOutstanding || 0),
      icon: AlertCircle,
      variant: 'warning',
      description: 'Tổng khoản phải thu còn mở',
    },
    {
      title: 'Công suất trung tâm',
      value: formatPercent(summary?.centerCapacityRate || 0),
      icon: Gauge,
      variant: 'success',
      description: `Ca học lấp đầy ${formatPercent(summary?.scheduleFillRate || 0)}`,
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Bảng điều khiển quản trị</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
              <Radio size={13} className={clsx(isRefreshing && 'animate-pulse')} />
              Realtime
            </span>
          </div>
          <p className="text-slate-500 mt-1">
            Dữ liệu tự đồng bộ mỗi {formatRefreshInterval(DASHBOARD_REFRESH_INTERVAL_MS)}
            {lastUpdated ? `, lần gần nhất ${lastUpdated.toLocaleTimeString('vi-VN')}` : ''}.
          </p>
          {error ? (
            <p className="mt-2 text-sm font-semibold text-rose-600">
              Lỗi tải dữ liệu dashboard: {error}
            </p>
          ) : null}
        </div>
        <Button variant="outline" className="md:self-end" onClick={handleExportReport} disabled={!data}>
          Xuất báo cáo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <KpiCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <Card className="xl:col-span-8" title="Xu hướng kinh doanh 6 tháng" subtitle="Lead, hợp đồng và dòng tiền đã thu">
          <TrendChart data={data?.monthlyTrend || []} />
        </Card>

        <Card className="xl:col-span-4" title="Phễu tiềm năng" subtitle="Tỷ trọng lead theo trạng thái">
          <PipelineDonut data={data?.leadsByStage || []} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <Card className="xl:col-span-7" title="Lịch thi theo tháng" subtitle="Số học sinh có lịch thi thật và mock test trong 6 tháng">
          <ExamMonthlyChart data={data?.examMonthlyTrend || []} />
        </Card>

        <Card className="xl:col-span-5" title="Công suất vận hành" subtitle="Sĩ số lớp đang học so với sức chứa đã cấu hình">
          <div className="space-y-5">
            <CapacityGauge
              label="Công suất trung tâm"
              value={summary?.centerCapacityRate || 0}
              detail={`${formatNumber(summary?.activeClassSeatsFilled || 0)}/${formatNumber(summary?.activeClassCapacity || 0)} chỗ đã lấp`}
            />
            <CapacityGauge
              label="Tỷ lệ lấp đầy ca học"
              value={summary?.scheduleFillRate || 0}
              detail="Tính theo sức chứa của các ca thuộc lớp đang học"
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <Card className="xl:col-span-7" title="Hiệu suất chi nhánh" subtitle="So sánh học sinh và hợp đồng đang hoạt động">
          <CenterPerformanceChart data={data?.centerBreakdown || []} />
        </Card>

        <Card className="xl:col-span-5" title="Cơ cấu công nợ" subtitle="Số tiền còn phải thu theo trạng thái">
          <ReceivableChart data={data?.receivablesByStatus || []} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Gia hạn & Tái tục sắp tới" subtitle="Hợp đồng đang hiệu lực sắp hết hạn trong 30 ngày">
          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-8">
              <TrendingUp size={42} className="text-slate-300 mb-3" />
              <p className="text-5xl font-black text-slate-900">{summary?.renewalCandidates || 0}</p>
              <p className="mt-2 text-sm font-medium text-slate-500">hợp đồng cần chăm sóc</p>
            </div>
            <div className="flex flex-col justify-center gap-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white">
              <p className="text-sm text-slate-300">
                Ưu tiên gọi chăm sóc và tạo kế hoạch tái tục cho các hợp đồng sắp hết hạn để giảm rủi ro rơi rụng.
              </p>
              <Button variant="secondary" className="w-fit bg-white text-slate-900 hover:bg-slate-100" onClick={() => window.location.href = '/academic/renewals'}>
                Xem danh sách <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Cảnh báo vận hành" subtitle="Các vấn đề cần xử lý ngay">
          <div className="space-y-4">
            {notifications.map((notif, idx) => (
              <div
                key={`${notif.type}-${idx}`}
                className={clsx(
                  'flex items-start gap-3 rounded-xl border p-4',
                  notif.priority === 'HIGH' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100',
                )}
              >
                {notif.priority === 'HIGH' ? (
                  <AlertCircle size={18} className="text-red-500 mt-0.5" />
                ) : (
                  <Clock size={18} className="text-amber-500 mt-0.5" />
                )}
                <div>
                  <p className={clsx('text-xs font-bold', notif.priority === 'HIGH' ? 'text-red-900' : 'text-amber-900')}>
                    {notif.title}
                  </p>
                  <p className={clsx('text-[10px] mt-1', notif.priority === 'HIGH' ? 'text-red-700' : 'text-amber-700')}>
                    {notif.body}
                  </p>
                </div>
              </div>
            ))}
            {notifications.length === 0 && (
              <EmptyState
                title="Hệ thống ổn định"
                description="Hiện tại không có cảnh báo vận hành nào cần xử lý gấp."
                icon={TrendingUp}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  variant,
  description,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  variant: string;
  description: string;
}) {
  return (
    <Card className="relative overflow-hidden border-none bg-white shadow-sm ring-1 ring-slate-100">
      <div className="min-h-[120px] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pr-1">
            <p className="whitespace-normal text-[11px] font-bold leading-4 text-slate-400 uppercase tracking-wide">
              {title}
            </p>
            <h3 className="mt-3 truncate text-2xl font-black tracking-tight text-slate-900">{value}</h3>
          </div>
          <div
            className={clsx(
              'shrink-0 rounded-2xl p-3 shadow-inner',
              variant === 'primary' && 'bg-blue-50 text-blue-600',
              variant === 'success' && 'bg-emerald-50 text-emerald-600',
              variant === 'info' && 'bg-sky-50 text-sky-600',
              variant === 'warning' && 'bg-amber-50 text-amber-600',
            )}
          >
            <Icon size={22} />
          </div>
        </div>
        <p className="mt-4 truncate text-[11px] font-medium text-slate-400">{description}</p>
      </div>
    </Card>
  );
}

function TrendChart({ data }: { data: ExecutiveDashboardData['monthlyTrend'] }) {
  const maxCash = Math.max(...data.map((item) => item.cashIn), 1);
  const maxLeads = Math.max(...data.map((item) => item.leads), 1);
  const chartPoints = data.map((item, index) => {
    const x = data.length === 1 ? 300 : 40 + index * (520 / Math.max(data.length - 1, 1));
    const y = 210 - (item.cashIn / maxCash) * 150;
    return { item, x, y };
  });
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 300 : 40 + index * (520 / Math.max(data.length - 1, 1));
    const y = 210 - (item.cashIn / maxCash) * 150;
    return `${x},${y}`;
  }).join(' ');

  if (!data.length) {
    return <EmptyState title="Chưa có dữ liệu xu hướng" description="Dữ liệu sẽ hiển thị khi hệ thống có lead, hợp đồng hoặc thanh toán." icon={TrendingUp} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-primary" /> Dòng tiền</span>
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Lead mới</span>
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Hợp đồng</span>
      </div>
      <div className="relative h-[280px] overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 p-4">
        <svg viewBox="0 0 600 240" className="h-full w-full" preserveAspectRatio="none">
          {[60, 110, 160, 210].map((y) => (
            <line key={y} x1="35" x2="580" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
          ))}
          <polyline points={points} fill="none" stroke="var(--primary-color)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {chartPoints.map(({ item, x, y }) => {
            return <circle key={item.month} cx={x} cy={y} r="5" fill="white" stroke="var(--primary-color)" strokeWidth="3" />;
          })}
        </svg>
        {chartPoints.map(({ item, x, y }) => (
          <div
            key={`hover-${item.month}`}
            className="group absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${(x / 600) * 100}%`, top: `${(y / 240) * 100}%` }}
          >
            <div className="h-full w-full rounded-full border-2 border-primary/30 bg-primary/10 opacity-0 transition-opacity group-hover:opacity-100" />
            <ChartTooltip className="left-1/2 top-[-92px] -translate-x-1/2">
              <p className="font-bold text-white">{item.month}</p>
              <p>Dòng tiền: {formatCurrency(item.cashIn)}</p>
              <p>Lead mới: {item.leads}</p>
              <p>Hợp đồng: {item.contracts}</p>
            </ChartTooltip>
          </div>
        ))}
        <div className="absolute inset-x-4 bottom-3 grid" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((item) => (
            <div key={item.month} className="text-center text-[10px] font-bold text-slate-400">{item.month}</div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-6">
        {data.map((item) => (
          <div key={item.month} className="group relative rounded-lg border border-slate-100 bg-white p-3 transition-shadow hover:shadow-md">
            <p className="text-[10px] font-bold text-slate-400">{item.month}</p>
            <p className="mt-1 text-sm font-black text-slate-900">{compactCurrency(item.cashIn)}</p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(item.leads / maxLeads) * 100}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-slate-500">{item.leads} lead · {item.contracts} HĐ</p>
            <ChartTooltip className="bottom-full left-1/2 mb-2 -translate-x-1/2">
              <p className="font-bold text-white">{item.month}</p>
              <p>Giá trị HĐ: {formatCurrency(item.contractValue)}</p>
              <p>Đã thu: {formatCurrency(item.cashIn)}</p>
            </ChartTooltip>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineDonut({ data }: { data: ExecutiveDashboardData['leadsByStage'] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let offset = 25;

  if (!total) {
    return <EmptyState title="Chưa có lead" description="Phễu sẽ được cập nhật tự động khi có dữ liệu CRM." icon={Target} />;
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-56 w-56">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="6" />
          {data.map((item, index) => {
            const portion = (item.count / total) * 100;
            const dash = `${portion} ${100 - portion}`;
            const segment = (
              <circle
                key={item.stage}
                cx="21"
                cy="21"
                r="15.915"
                fill="transparent"
                stroke={STAGE_COLORS[index % STAGE_COLORS.length]}
                strokeWidth="6"
                strokeDasharray={dash}
                strokeDashoffset={offset}
              />
            );
            offset -= portion;
            return segment;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-slate-900">{total}</span>
          <span className="text-xs font-bold text-slate-400">leads</span>
        </div>
      </div>
      <div className="w-full space-y-3">
        {data.map((item, index) => (
          <div key={item.stage} className="group relative flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-slate-50">
            <span className="flex items-center gap-2 font-semibold text-slate-600">
              <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STAGE_COLORS[index % STAGE_COLORS.length] }} />
              {item.stage}
            </span>
            <span className="font-mono text-xs text-slate-400">{Math.round((item.count / total) * 100)}%</span>
            <ChartTooltip className="bottom-full right-0 mb-2">
              <p className="font-bold text-white">{item.stage}</p>
              <p>{item.count} lead</p>
              <p>{Math.round((item.count / total) * 100)}% tổng pipeline</p>
            </ChartTooltip>
          </div>
        ))}
      </div>
    </div>
  );
}

function CenterPerformanceChart({ data }: { data: ExecutiveDashboardData['centerBreakdown'] }) {
  const maxValue = Math.max(...data.map((item) => Math.max(item.activeStudents, item.activeContracts)), 1);

  if (!data.length) {
    return <EmptyState title="Chưa có dữ liệu trung tâm" description="Các trung tâm sẽ xuất hiện khi có phân quyền hoặc dữ liệu vận hành." icon={Building2} />;
  }

  return (
    <div className="space-y-5">
      {data.map((center) => (
        <div key={center.id} className="rounded-xl border border-slate-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Building2 size={17} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{center.name}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{center.code}</p>
              </div>
            </div>
            <Badge variant="success">Đang hoạt động</Badge>
          </div>
          <MetricBar label="Học sinh" value={center.activeStudents} max={maxValue} color="bg-primary" detail={`${center.activeStudents} học sinh đang học tại ${center.code}`} />
          <MetricBar label="Hợp đồng" value={center.activeContracts} max={maxValue} color="bg-emerald-500" detail={`${center.activeContracts} hợp đồng đang hiệu lực tại ${center.code}`} />
        </div>
      ))}
    </div>
  );
}

function ReceivableChart({ data }: { data: ExecutiveDashboardData['receivablesByStatus'] }) {
  const maxAmount = Math.max(...data.map((item) => item.amount), 1);

  if (!data.length) {
    return <EmptyState title="Không có công nợ mở" description="Các khoản phải thu sẽ tự xuất hiện khi có lịch thanh toán chưa hoàn tất." icon={FileText} />;
  }

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.status} className="group relative space-y-2 rounded-lg p-2 transition-colors hover:bg-slate-50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">{statusLabel(item.status)}</span>
            <span className="text-xs font-semibold text-slate-500">{formatCurrency(item.amount)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className={clsx('h-full rounded-full', item.status === 'OVERDUE' ? 'bg-rose-500' : item.status === 'PARTIAL' ? 'bg-amber-500' : 'bg-primary')}
              style={{ width: `${(item.amount / maxAmount) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400">{item.count} lịch thanh toán</p>
          <ChartTooltip className="bottom-full right-0 mb-2">
            <p className="font-bold text-white">{statusLabel(item.status)}</p>
            <p>{item.count} lịch thanh toán</p>
            <p>{formatCurrency(item.amount)}</p>
          </ChartTooltip>
        </div>
      ))}
    </div>
  );
}

function ExamMonthlyChart({ data }: { data: ExecutiveDashboardData['examMonthlyTrend'] }) {
  const maxValue = Math.max(
    ...data.map((item) => Math.max(item.realExamStudents, item.mockTestStudents)),
    1,
  );

  if (!data.length) {
    return <EmptyState title="Chưa có lịch thi" description="Lịch thi thật và mock test sẽ hiển thị khi được tạo trong hồ sơ học sinh." icon={CalendarCheck} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Thi thật</span>
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-primary" /> Mock test</span>
      </div>
      <div className="grid h-[260px] grid-cols-6 items-end gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
        {data.map((item) => (
          <div key={item.month} className="group relative flex h-full min-w-0 flex-col justify-end gap-2">
            <div className="flex min-h-0 flex-1 items-end justify-center gap-1.5">
              <div
                className="w-4 rounded-t-md bg-rose-500"
                style={{ height: `${Math.max((item.realExamStudents / maxValue) * 100, item.realExamStudents ? 8 : 0)}%` }}
              />
              <div
                className="w-4 rounded-t-md bg-primary"
                style={{ height: `${Math.max((item.mockTestStudents / maxValue) * 100, item.mockTestStudents ? 8 : 0)}%` }}
              />
            </div>
            <p className="truncate text-center text-[10px] font-bold text-slate-400">{item.month}</p>
            <ChartTooltip className="bottom-full left-1/2 mb-2 -translate-x-1/2">
              <p className="font-bold text-white">{item.month}</p>
              <p>Thi thật: {item.realExamStudents} học sinh</p>
              <p>Mock test: {item.mockTestStudents} học sinh</p>
            </ChartTooltip>
          </div>
        ))}
      </div>
    </div>
  );
}

function CapacityGauge({ label, value, detail }: { label: string; value: number; detail: string }) {
  const normalized = Math.max(0, Math.min(value, 100));

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-900">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <span className="text-2xl font-black text-slate-900">{formatPercent(value)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={clsx(
            'h-full rounded-full',
            normalized >= 85 ? 'bg-emerald-500' : normalized >= 60 ? 'bg-primary' : 'bg-amber-500',
          )}
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}

function MetricBar({ label, value, max, color, detail }: { label: string; value: number; max: number; color: string; detail: string }) {
  return (
    <div className="group relative mt-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-500">{label}</span>
        <span className="font-bold text-slate-700">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <ChartTooltip className="bottom-full right-0 mb-2">
        <p className="font-bold text-white">{label}</p>
        <p>{detail}</p>
      </ChartTooltip>
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    UNPAID: 'Chưa thanh toán',
    PARTIAL: 'Thanh toán một phần',
    OVERDUE: 'Quá hạn',
    PAID: 'Đã thanh toán',
  };
  return labels[status] || status;
}

function ChartTooltip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'pointer-events-none absolute z-30 w-max max-w-[220px] rounded-lg bg-slate-950 px-3 py-2 text-[11px] leading-5 text-slate-200 opacity-0 shadow-xl ring-1 ring-white/10 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100',
        className,
      )}
    >
      {children}
    </div>
  );
}

function parseRefreshInterval(value?: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 5000) return 30000;
  return parsed;
}

function formatRefreshInterval(value: number) {
  if (value % 1000 === 0) return `${value / 1000} giây`;
  return `${value} ms`;
}

function formatNumber(value: number) {
  return value.toLocaleString('vi-VN');
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('vi-VN')} ₫`;
}

function formatPercent(value: number) {
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
}

function compactCurrency(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} tr`;
  return formatCurrency(value);
}

function clsx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}
