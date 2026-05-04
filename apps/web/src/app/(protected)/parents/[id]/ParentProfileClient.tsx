'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { apiFetch } from '@/lib/api';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  MessageSquare, 
  ChevronLeft,
  CircleUser,
  GraduationCap,
  History
} from 'lucide-react';
import Link from 'next/link';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';

export default function ParentProfileClient({ id }: { id: string }) {
  const [parent, setParent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchParent = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/parents/${id}`);
      setParent(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParent();
  }, [id]);

  if (loading) return <div className="p-8 animate-pulse text-slate-400">Đang tải hồ sơ phụ huynh...</div>;
  if (!parent) return <div className="p-8 text-center text-slate-500">Không tìm thấy phụ huynh.</div>;

  return (
    <ModuleBoundary moduleCode="FAMILY_PARENT">
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ChevronLeft size={20} /> Quay lại
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">Hồ sơ phụ huynh</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info Card */}
          <Card className="col-span-1 p-6 flex flex-col items-center text-center space-y-4">
            <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
              <CircleUser size={64} strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{parent.fullName}</h2>
              <p className="text-sm text-slate-500">Người giám hộ / liên hệ</p>
            </div>
            <div className="w-full pt-4 space-y-3 text-left">
              <div className="flex items-center gap-3 text-slate-600">
                <Phone size={16} />
                <span className="text-sm">{parent.phone}</span>
              </div>
              {parent.email && (
                <div className="flex items-center gap-3 text-slate-600">
                  <Mail size={16} />
                  <span className="text-sm">{parent.email}</span>
                </div>
              )}
              {parent.address && (
                <div className="flex items-start gap-3 text-slate-600">
                  <MapPin size={16} className="mt-1 flex-shrink-0" />
                  <span className="text-sm">{parent.address}</span>
                </div>
              )}
            </div>
            <div className="w-full pt-4 border-t border-slate-100 flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1">
                <MessageSquare size={12} /> {parent.preferredCommunicationChannel || 'Chưa thiết lập'}
              </Badge>
            </div>
          </Card>

          {/* Children & Relationships */}
          <div className="md:col-span-2 space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <GraduationCap size={20} className="text-blue-600" /> Học sinh liên kết
                </h3>
              </div>
              <div className="space-y-4">
                {parent.relations.map((rel: any) => (
                  <div key={rel.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-full border flex items-center justify-center text-xs font-bold text-slate-400">
                        {rel.student.fullName.charAt(0)}
                      </div>
                      <div>
                        <Link href={`/students/${rel.student.id}`} className="text-sm font-bold text-slate-900 hover:text-blue-600">
                          {rel.student.fullName}
                        </Link>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{rel.student.center.name}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="text-[10px]">{rel.relationship}</Badge>
                      {rel.isPrimaryPayer && <Badge variant="outline" className="text-emerald-600 border-emerald-100 bg-emerald-50 text-[10px]">Người thanh toán</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                <History size={20} className="text-slate-400" /> Hoạt động gần đây
              </h3>
              <div className="py-8 text-center text-slate-400 text-sm">
                Chưa có nhật ký hoạt động cho hồ sơ này.
              </div>
            </Card>
          </div>
        </div>
      </div>
    </ModuleBoundary>
  );
}
