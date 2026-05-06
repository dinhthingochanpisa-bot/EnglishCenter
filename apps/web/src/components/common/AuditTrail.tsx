'use client';

import React, { useEffect, useState } from 'react';
import { History, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { apiFetch } from '@/lib/api';

export function AuditTrail({
  entityType,
  entityId,
  title = 'Lịch sử chỉnh sửa',
}: {
  entityType: string;
  entityId: string;
  title?: string;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    apiFetch(`/admin/audit-logs?limit=8&entity=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`)
      .then((data) => {
        if (mounted) setItems(data.items || []);
      })
      .catch(() => {
        if (mounted) setItems([]);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [entityType, entityId]);

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <History size={18} className="text-slate-500" /> {title}
        </h3>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      {isLoading ? (
        <p className="py-6 text-center text-sm text-slate-400">Đang tải lịch sử...</p>
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{item.action}</Badge>
                  <span className="text-sm font-semibold text-slate-800">
                    {item.actor?.fullName || item.actor?.email || 'Tài khoản hệ thống'}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={12} /> {new Date(item.timestamp).toLocaleString('vi-VN')}
                </span>
              </div>
              {item.actor?.email && <p className="mt-1 text-xs text-slate-500">{item.actor.email}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-slate-400">Chưa có lịch sử chỉnh sửa.</p>
      )}
    </Card>
  );
}
