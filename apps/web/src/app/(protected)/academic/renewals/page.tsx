"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { ModuleBoundary } from "@/components/common/ModuleBoundary";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RenewalsClient } from "@/lib/api/commercial";

type RenewalCandidate = {
  id: string;
  code: string;
  student: {
    id: string;
    fullName: string;
    code: string;
    phone?: string | null;
  };
  planName: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  estimatedEndDate?: string | Date | null;
  className: string;
  urgencyLevel: "CRITICAL" | "POTENTIAL";
};

export default function RenewalsPage() {
  const [candidates, setCandidates] = useState<RenewalCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");

  const fetchCandidates = useCallback(async (searchKeyword?: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await RenewalsClient.findCandidates(20, searchKeyword);
      setCandidates(data as RenewalCandidate[]);
    } catch (err: any) {
      setCandidates([]);
      setError(err.message || "Không thể tải danh sách học sinh cần gia hạn");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const trimmedKeyword = keyword.trim();
    const timer = setTimeout(
      () => {
        fetchCandidates(trimmedKeyword || undefined);
      },
      trimmedKeyword ? 500 : 0,
    );

    return () => clearTimeout(timer);
  }, [keyword, fetchCandidates]);

  const handleCreateRenewal = async (contractId: string) => {
    setProcessingId(contractId);
    setError(null);
    setSuccess(null);

    try {
      await RenewalsClient.createRenewal(contractId);
      setSuccess("Đã tạo bản ghi tư vấn gia hạn thành công");
      await fetchCandidates(keyword.trim() || undefined);
    } catch (err: any) {
      setError(err.message || "Không thể tạo bản ghi gia hạn");
    } finally {
      setProcessingId(null);
    }
  };

  const criticalCount = useMemo(
    () =>
      candidates.filter((candidate) => candidate.urgencyLevel === "CRITICAL")
        .length,
    [candidates],
  );

  return (
    <ModuleBoundary moduleCode="RENEWAL_RETENTION">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <RefreshCw className="text-primary" />
              Gia hạn & Tái tục
            </h1>
            <p className="text-slate-500 text-sm">
              Quản lý học sinh còn từ 20 buổi học trở xuống trong hợp đồng.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-1">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-600 animate-in fade-in slide-in-from-top-1">
            <CheckCircle2 size={20} />
            <p className="text-sm font-medium">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 border-l-4 border-l-red-500 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Cần xử lý gấp
                </p>
                <p className="text-3xl font-black text-slate-900">
                  {criticalCount}
                </p>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">
                  Học sinh còn từ 7 buổi trở xuống
                </p>
              </div>
              <div className="p-3 bg-red-50 text-red-500 rounded-xl">
                <Bell size={24} />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-l-4 border-l-primary shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Tiềm năng gia hạn
                </p>
                <p className="text-3xl font-black text-slate-900">
                  {candidates.length}
                </p>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">
                  Học sinh còn từ 20 buổi trở xuống
                </p>
              </div>
              <div className="p-3 bg-primary/5 text-primary rounded-xl">
                <Users size={24} />
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Tìm học sinh theo tên, mã hoặc số điện thoại..."
                className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm w-full outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>
          </div>

          {loading && candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p className="text-sm font-medium">
                Đang phân tích dữ liệu buổi học...
              </p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-20 text-slate-400 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
              <RefreshCw size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-medium">
                Không có học sinh nào còn từ 20 buổi trở xuống.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {candidates.map((candidate) => {
                const progressPercent =
                  candidate.totalSessions > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (candidate.usedSessions / candidate.totalSessions) *
                            100,
                        ),
                      )
                    : 0;

                return (
                  <Card
                    key={candidate.id}
                    className="p-5 border-slate-100 hover:shadow-lg transition-all group relative overflow-hidden"
                  >
                    {candidate.urgencyLevel === "CRITICAL" && (
                      <div className="absolute top-0 right-0 w-2 h-full bg-red-500" />
                    )}

                    <div className="flex justify-between items-start mb-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-900 truncate">
                          {candidate.student.fullName}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">
                          {candidate.student.code} • {candidate.code}
                        </p>
                      </div>
                      <Badge
                        variant={
                          candidate.urgencyLevel === "CRITICAL"
                            ? "warning"
                            : "outline"
                        }
                        className="text-[9px] px-1.5 py-0 uppercase tracking-widest whitespace-nowrap"
                      >
                        Còn {candidate.remainingSessions} buổi
                      </Badge>
                    </div>

                    <div className="space-y-2.5 mb-6">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 flex items-center gap-1">
                          <BookOpen size={12} /> Lớp hiện tại:
                        </span>
                        <span className="font-bold text-slate-700 truncate max-w-[160px]">
                          {candidate.className}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Gói phí:</span>
                        <span className="font-medium text-slate-600 italic truncate max-w-[150px]">
                          {candidate.planName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Phone size={12} /> Liên hệ:
                        </span>
                        <span className="font-medium text-slate-600">
                          {candidate.student.phone || "Chưa có"}
                        </span>
                      </div>
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[10px] font-bold mb-1">
                          <span className="text-slate-400 uppercase tracking-tighter">
                            Tiến độ buổi học
                          </span>
                          <span className="text-primary">
                            {candidate.usedSessions} / {candidate.totalSessions}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ${
                              candidate.urgencyLevel === "CRITICAL"
                                ? "bg-red-500"
                                : "bg-primary"
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Calendar size={12} /> Dự kiến kết thúc:
                        </span>
                        <span
                          className={`font-bold ${
                            candidate.urgencyLevel === "CRITICAL"
                              ? "text-red-500"
                              : "text-slate-700"
                          }`}
                        >
                          {candidate.estimatedEndDate
                            ? format(
                                new Date(candidate.estimatedEndDate),
                                "dd/MM/yyyy",
                              )
                            : "Chưa đủ dữ liệu"}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant={
                        candidate.urgencyLevel === "CRITICAL"
                          ? "primary"
                          : "outline"
                      }
                      size="sm"
                      className="w-full gap-2 transition-all"
                      onClick={() => handleCreateRenewal(candidate.id)}
                      disabled={processingId === candidate.id}
                    >
                      {processingId === candidate.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          Ghi nhận tư vấn
                          <ArrowRight size={14} />
                        </>
                      )}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </ModuleBoundary>
  );
}
