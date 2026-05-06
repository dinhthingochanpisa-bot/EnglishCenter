'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { apiFetch } from '@/lib/api';
import { 
  Users, 
  MapPin, 
  CreditCard, 
  GraduationCap, 
  Calendar, 
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Phone,
  MessageSquare,
  ShieldAlert
} from 'lucide-react';
import Link from 'next/link';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';
import { PaymentsClient } from '@/lib/api/commercial';

export default function FamilyDetailClient({ id }: { id: string }) {
  const [family, setFamily] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [receivable, setReceivable] = useState<any>(null);

  const fetchFamily = async () => {
    setLoading(true);
    try {
      const [data, receivableData] = await Promise.all([
        apiFetch(`/families/${id}`),
        PaymentsClient.getFamilyReceivables(id).catch(() => ({ totalOutstanding: 0 }))
      ]);
      setFamily(data);
      setReceivable(receivableData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamily();
  }, [id]);

  if (loading) return <div className="p-8 animate-pulse text-slate-400">Loading family details...</div>;
  if (!family) return <div className="p-8 text-center text-slate-500">Family not found.</div>;

  const { summary } = family;

  return (
    <ModuleBoundary moduleCode="FAMILY_PARENT">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/families">
            <Button variant="secondary" size="sm" className="p-2">
              <ChevronLeft size={20} />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{family.name}</h1>
          <Badge variant="outline" className="font-mono">{family.code}</Badge>
          {!family.isFullyVisible && (
            <Badge variant="warning" className="gap-1">
              <ShieldAlert size={12} /> Partial Access (Scope Restricted)
            </Badge>
          )}
        </div>

        {/* Family Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-5 flex flex-col gap-3 bg-white border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600">
              <Users size={18} />
              <span className="text-sm font-medium uppercase tracking-wider">Members</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-slate-900">{summary.totalChildren} Children</span>
              <span className="text-xs text-slate-500">{summary.activeStudents} Active Students</span>
            </div>
          </Card>

          <Card className="p-5 flex flex-col gap-3 bg-white border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600">
              <MapPin size={18} />
              <span className="text-sm font-medium uppercase tracking-wider">Centers</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-slate-900">{summary.centersInvolved} Centers</span>
              <span className="text-xs text-slate-500">Cross-center family</span>
            </div>
          </Card>

          <Card className="p-5 flex flex-col gap-3 bg-amber-50/50 border-amber-100 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600">
              <CreditCard size={18} />
              <span className="text-sm font-medium uppercase tracking-wider text-amber-900">Balance</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-slate-900">
                {(receivable?.totalOutstanding || 0).toLocaleString()} ₫
              </span>
              <span className="text-xs text-amber-700">Total Outstanding</span>
            </div>
          </Card>

          <Card className="p-5 flex flex-col gap-3 bg-purple-50/50 border-purple-100 shadow-sm">
            <div className="flex items-center gap-2 text-purple-600">
              <Calendar size={18} />
              <span className="text-sm font-medium uppercase tracking-wider text-purple-900">Renewals</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-slate-900">0</span>
              <span className="text-xs text-purple-700 font-medium">Pending Renewals</span>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Members List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <GraduationCap size={20} /> Students ({summary.totalChildren})
            </h2>
            <div className="space-y-3">
              {family.relations.map((rel: any) => (
                <Card key={rel.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                      {rel.student.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/students/${rel.student.id}`} className="font-bold text-slate-900 hover:text-blue-600">
                          {rel.student.fullName}
                        </Link>
                        <Badge variant="secondary" className="text-[10px]">{rel.student.code}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin size={12} /> {rel.student.center.name}
                        </span>
                        <Badge className={`${rel.student.status === 'STUDYING' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'} text-[10px] border-none`}>
                          {rel.student.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {rel.isPrimaryPayer && <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px]">Người thanh toán</Badge>}
                    {rel.isPrimaryContact && <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 text-[10px]">Liên hệ chính</Badge>}
                  </div>
                </Card>
              ))}
            </div>

            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mt-8">
              <Users size={20} /> Phụ huynh / Người giám hộ
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {family.relations.map((rel: any) => rel.parentId).filter((v: any, i: any, a: any) => a.indexOf(v) === i).map((parentId: string) => {
                const parent = family.relations.find((r: any) => r.parentId === parentId).parent;
                return (
                  <Card key={parentId} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-slate-900">{parent.fullName}</h3>
                      {parent.preferredCommunicationChannel && (
                        <Badge variant="info" className="text-[10px] uppercase">{parent.preferredCommunicationChannel}</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500 flex items-center gap-2"><Phone size={12} /> {parent.phone}</p>
                      {parent.email && <p className="text-xs text-slate-500 flex items-center gap-2"><MessageSquare size={12} /> {parent.email}</p>}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Timeline Placeholder */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Family Timeline</h2>
            <Card className="p-4 border-dashed border-2 border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center py-12 text-center">
              <div className="p-3 bg-white rounded-full text-slate-300 mb-3 border">
                <CheckCircle2 size={24} />
              </div>
              <p className="text-sm font-medium text-slate-400">Milestone timeline</p>
              <p className="text-xs text-slate-400 mt-1">Cross-center events will appear here based on your access level.</p>
            </Card>
          </div>
        </div>
      </div>
    </ModuleBoundary>
  );
}
