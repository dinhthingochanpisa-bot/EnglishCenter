'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Mail, Phone, Search, UserRound } from 'lucide-react';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { apiFetch } from '@/lib/api';

export default function ParentsPage() {
  const [parents, setParents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParents = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const data = await apiFetch<any[]>(`/parents${query}`);
      setParents(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách phụ huynh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchParents, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <ModuleBoundary moduleCode="FAMILY_PARENT">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Phụ huynh</h1>
          <p className="text-slate-500">Tra cứu hồ sơ phụ huynh, liên hệ và học sinh liên quan.</p>
        </div>

        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              placeholder="Tìm theo tên, số điện thoại hoặc email..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="h-40 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {parents.map((parent) => {
              const childCount = parent.relations?.length || 0;
              const leadCount = parent.leads?.length || parent._count?.leads || 0;
              const firstRelation = parent.relations?.[0];
              const latestLead = parent.leads?.[0];

              return (
                <Link key={parent.id} href={`/parents/${parent.id}`}>
                  <Card className="p-5 hover:border-blue-500 transition-colors group cursor-pointer h-full">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-11 w-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <UserRound size={22} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {parent.fullName}
                          </h3>
                          <p className="text-xs text-slate-500 truncate">
                            {firstRelation?.family?.name || latestLead?.prospectiveStudentName || 'Chưa liên kết gia đình'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-transform shrink-0" />
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Phone size={15} className="text-slate-400" />
                        <span>{parent.phone}</span>
                      </div>
                      {parent.email && (
                        <div className="flex items-center gap-2">
                          <Mail size={15} className="text-slate-400" />
                          <span className="truncate">{parent.email}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="secondary">{childCount} học sinh</Badge>
                      <Badge variant="outline">{leadCount} lead</Badge>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {!loading && parents.length === 0 && !error && (
          <div className="text-center py-12 text-sm text-slate-400">
            Không tìm thấy phụ huynh phù hợp.
          </div>
        )}
      </div>
    </ModuleBoundary>
  );
}
