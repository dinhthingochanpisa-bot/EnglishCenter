"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  ChevronLeft,
  Calendar,
  Users,
  CheckCircle2,
  GraduationCap,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
  MapPin,
  Save,
  X,
  Pencil,
  Search,
  Phone,
  ArrowRightLeft,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppDialog } from "@/providers/AppDialogProvider";
import { AuditTrail } from "@/components/common/AuditTrail";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachWeekOfInterval, subWeeks, addWeeks, subMonths, addMonths } from "date-fns";
import { vi } from "date-fns/locale";

type Tab = "overview" | "roster" | "attendance" | "results";

export default function ClassDetailClient({ id }: { id: string }) {
  const { notify, confirm } = useAppDialog();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    status: "PLANNING",
    capacity: "20",
  });

  // Periodic Comments State
  const [periodicComments, setPeriodicComments] = useState<any[]>([]);
  const [periodType, setPeriodType] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");
  const [periodKey, setPeriodKey] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [commentSearch, setCommentSearch] = useState("");
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [activeCommentStudent, setActiveCommentStudent] = useState<any>(null);
  const [commentForm, setCommentForm] = useState({
    content: "",
    strengths: "",
    improvements: "",
    nextSteps: "",
    teacherId: "",
  });

  const router = useRouter();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const resp = await apiFetch(`/academic/classes/${id}`);
      setData(resp);

      // Initialize attendance records based on students
      if (resp.students) {
        setAttendanceRecords(
          resp.students.map((s: any) => ({
            studentId: s.student.id,
            fullName: s.student.fullName,
            status: "PRESENT",
          })),
        );
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Set initial period key
  useEffect(() => {
    if (!periodKey) {
      const now = new Date();
      if (periodType === "WEEKLY") {
        const sw = startOfWeek(now, { weekStartsOn: 1 });
        setPeriodKey(format(sw, "yyyy-'W'ww"));
      } else {
        setPeriodKey(format(now, "yyyy-MM"));
      }
    }
  }, [periodType]);

  const fetchPeriodicComments = async () => {
    if (activeTab !== "results" || !periodKey) return;
    setIsCommentsLoading(true);
    try {
      const query = new URLSearchParams({
        periodType,
        periodKey,
        teacherId: selectedTeacherId,
        search: commentSearch,
      });
      const resp = await apiFetch(
        `/academic/classes/${id}/periodic-comments?${query}`,
      );
      setPeriodicComments(resp as any[]);
    } catch (err: any) {
      notify({
        type: "error",
        title: "Lỗi tải nhận xét",
        message: err.message,
      });
    } finally {
      setIsCommentsLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const resp = await apiFetch(`/academic/classes/${id}/teachers`);
      setTeachers(resp as any[]);
    } catch (err) {
      console.error("Failed to fetch teachers", err);
    }
  };

  useEffect(() => {
    if (activeTab === "results") {
      fetchPeriodicComments();
      if (teachers.length === 0) fetchTeachers();
    }
  }, [activeTab, periodType, periodKey, selectedTeacherId, commentSearch]);

  const openEnrollModal = () => {
    setShowEnrollModal(true);
    setSelectedStudent(null);
    setSearchKeyword("");
    setAvailableStudents([]);
    setSearchError(null);
  };

  useEffect(() => {
    if (!showEnrollModal) return;
    const keyword = searchKeyword.trim();

    if (!keyword) {
      setAvailableStudents([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    let ignore = false;

    const handler = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const students = await apiFetch(
          `/academic/classes/${id}/available-students?keyword=${encodeURIComponent(keyword)}`,
        );
        if (!ignore) {
          setAvailableStudents(students as any[]);
        }
      } catch (err: any) {
        if (!ignore) {
          setAvailableStudents([]);
          setSearchError(err.message || "Không thể tìm kiếm học sinh");
        }
      } finally {
        if (!ignore) {
          setIsSearching(false);
        }
      }
    }, 400);

    return () => {
      ignore = true;
      clearTimeout(handler);
    };
  }, [searchKeyword, showEnrollModal, id]);

  const openEditModal = () => {
    setEditForm({
      name: data.name || "",
      code: data.code || "",
      status: data.status || "PLANNING",
      capacity: String(data.capacity || 20),
    });
    setShowEditModal(true);
  };

  const handleUpdateClass = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await apiFetch(`/academic/classes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name.trim(),
          code: editForm.code.trim(),
          status: editForm.status,
          capacity: Number(editForm.capacity || 20),
        }),
      });
      setShowEditModal(false);
      await fetchData();
      notify({ type: "success", title: "Đã cập nhật thông tin lớp" });
    } catch (err: any) {
      notify({
        type: "error",
        title: "Không thể cập nhật lớp",
        message: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnrollStudent = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (!selectedStudent) return;

    const isTransfer = selectedStudent.classStudent?.length > 0;
    const currentClassName = selectedStudent.classStudent?.[0]?.class?.name;

    if (isTransfer) {
      const confirmed = await confirm({
        title: "Xác nhận chuyển lớp",
        message: `Học sinh ${selectedStudent.fullName} đang thuộc lớp [${currentClassName}]. Bạn có chắc chắn muốn chuyển học sinh này sang lớp [${data.name}] không?`,
        confirmLabel: "Chuyển lớp",
        cancelLabel: "Hủy",
      });
      if (!confirmed) return;
    }

    setIsSaving(true);
    try {
      await apiFetch(`/academic/classes/${id}/enroll`, {
        method: "POST",
        body: JSON.stringify({ studentId: selectedStudent.id }),
      });
      setShowEnrollModal(false);
      await fetchData();
      notify({
        type: "success",
        title: isTransfer
          ? "Đã chuyển lớp thành công"
          : "Đã thêm học sinh vào lớp",
      });
    } catch (err: any) {
      notify({
        type: "error",
        title: "Không thể thực hiện thao tác",
        message: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnenrollStudent = async (studentId: string) => {
    setIsSaving(true);
    try {
      await apiFetch(`/academic/classes/${id}/unenroll/${studentId}`, {
        method: "DELETE",
      });
      await fetchData();
      notify({ type: "success", title: "Đã xóa học sinh khỏi lớp" });
    } catch (err: any) {
      notify({
        type: "error",
        title: "Không thể xóa học sinh",
        message: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAttendance = async () => {
    try {
      await apiFetch("/academic/attendance/batch", {
        method: "POST",
        body: JSON.stringify({
          classId: id,
          date: attendanceDate,
          records: attendanceRecords.map((r) => ({
            studentId: r.studentId,
            status: r.status,
          })),
        }),
      });
      notify({ type: "success", title: "Đã lưu điểm danh" });
    } catch (err: any) {
      notify({
        type: "error",
        title: "Không thể lưu điểm danh",
        message: err.message,
      });
    }
  };

  const handleOpenCommentModal = (student: any) => {
    setActiveCommentStudent(student);
    const existing = student.comment;
    setCommentForm({
      content: existing?.content || "",
      strengths: existing?.strengths || "",
      improvements: existing?.improvements || "",
      nextSteps: existing?.nextSteps || "",
      teacherId: existing?.teacherId || selectedTeacherId || data.teacher?.id || "",
    });
    setShowCommentModal(true);
  };

  const handleSaveComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeCommentStudent) return;
    setIsSaving(true);
    try {
      await apiFetch(`/academic/classes/${id}/periodic-comments`, {
        method: "POST",
        body: JSON.stringify({
          studentId: activeCommentStudent.studentId,
          teacherId: commentForm.teacherId,
          periodType,
          periodKey,
          content: commentForm.content.trim(),
          strengths: commentForm.strengths.trim(),
          improvements: commentForm.improvements.trim(),
          nextSteps: commentForm.nextSteps.trim(),
        }),
      });
      setShowCommentModal(false);
      await fetchPeriodicComments();
      notify({ type: "success", title: "Đã lưu nhận xét định kỳ" });
    } catch (err: any) {
      notify({
        type: "error",
        title: "Lỗi lưu nhận xét",
        message: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isPremiumPlan = (contracts: any[]) => {
    return (contracts || []).some((c) =>
      /Diamond|VIP|Premium|Intensive|1-1/i.test(
        c.productName || c.productRank || c.feePackage || "",
      ),
    );
  };

  const getPeriodOptions = () => {
    const now = new Date();
    if (periodType === "WEEKLY") {
      const start = subWeeks(now, 8);
      const end = addWeeks(now, 2);
      return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map((w) => {
        const sw = startOfWeek(w, { weekStartsOn: 1 });
        const ew = endOfWeek(w, { weekStartsOn: 1 });
        const key = format(sw, "yyyy-'W'ww");
        const label = `Tuần ${format(sw, "ww")} (${format(sw, "dd/MM")} - ${format(ew, "dd/MM")})`;
        return { key, label };
      });
    } else {
      const options = [];
      for (let i = -6; i <= 2; i++) {
        const d = addMonths(now, i);
        const key = format(d, "yyyy-MM");
        const label = `Tháng ${format(d, "MM/yyyy")}`;
        options.push({ key, label });
      }
      return options;
    }
  };

  if (isLoading)
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 gap-3">
        <Loader2 className="animate-spin" size={40} />
        <p className="font-medium">Đang tải chi tiết lớp học...</p>
      </div>
    );

  if (error || !data)
    return (
      <div className="p-10 text-center">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Lỗi tải dữ liệu
        </h2>
        <p className="text-slate-500 mb-6">
          {error || "Không tìm thấy lớp học"}
        </p>
        <Button onClick={() => router.back()}>Quay lại</Button>
      </div>
    );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Link href="/academic/classes">
          <Button
            variant="ghost"
            size="sm"
            className="p-2 h-auto rounded-full hover:bg-slate-100"
          >
            <ChevronLeft size={20} />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{data.name}</h1>
            <Badge variant="success">{getClassStatusLabel(data.status)}</Badge>
          </div>
          <p className="text-sm text-slate-500 font-medium">
            {data.program?.name} • {data.code}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={openEditModal}>
            <Pencil size={18} /> Chỉnh sửa
          </Button>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        {[
          { id: "overview", label: "Tổng quan", icon: Calendar },
          { id: "roster", label: "Danh sách lớp", icon: Users },
          { id: "attendance", label: "Điểm danh", icon: CheckCircle2 },
          { id: "results", label: "Nhận xét định kỳ", icon: GraduationCap },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative ${
              activeTab === tab.id
                ? "text-primary"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-6 space-y-8">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
                  <Clock size={16} className="text-primary" /> Lịch học
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.schedules?.map((s: any) => (
                    <div
                      key={s.id}
                      className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-4"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-primary font-bold">
                        {
                          ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][
                            s.dayOfWeek - 1
                          ]
                        }
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {s.startTime} - {s.endTime}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin size={10} /> Phòng: {s.room || "Chưa xếp"}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!data.schedules?.length && (
                    <p className="text-sm text-slate-400 italic">
                      Chưa có lịch học.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
                  Giáo viên & Quản lý
                </h3>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 w-full md:w-1/2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    {data.teacher?.fullName?.charAt(0) || "GV"}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {data.teacher?.fullName || "Chưa phân công"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Giáo viên chủ nhiệm
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 h-fit bg-slate-900 text-white border-none shadow-xl shadow-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-60 mb-6">
                Trạng thái vận hành
              </h3>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm opacity-80">Sĩ số hiện tại</span>
                  <span className="text-lg font-bold">
                    {data._count?.students || 0} / {data.capacity}
                  </span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)] transition-all duration-1000"
                    style={{
                      width: `${(data._count?.students / data.capacity) * 100}%`,
                    }}
                  />
                </div>
                <div className="pt-4 space-y-3">
                  <div className="flex items-center justify-between text-xs opacity-70">
                    <span>Tỷ lệ lấp đầy</span>
                    <span>
                      {Math.round(
                        (data._count?.students / data.capacity) * 100,
                      )}
                      %
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs opacity-70">
                    <span>Ngày bắt đầu</span>
                    <span>24/04/2026</span>
                  </div>
                </div>
              </div>
            </Card>
            <AuditTrail entityType="Class" entityId={id} />
          </div>
        )}

        {activeTab === "roster" && (
          <Card className="p-0 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Danh sách học sinh ({data.students?.length || 0})
              </h3>
              <Button size="sm" className="gap-2" onClick={openEnrollModal}>
                <Plus size={16} /> Thêm học sinh
              </Button>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/30 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Học sinh</th>
                  <th className="px-6 py-4">Mã số</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4">Ngày vào lớp</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.students?.map((s: any) => (
                  <tr
                    key={s.student.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/students/${s.student.id}`}
                        className="flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                          {s.student.fullName?.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-slate-700 group-hover:text-primary transition-colors">
                          {s.student.fullName}
                        </span>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500 uppercase">
                      {s.student.code}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-bold uppercase tracking-tighter"
                      >
                        {getStudentStatusLabel(s.student.status)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(s.joinedAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        onClick={() => handleUnenrollStudent(s.student.id)}
                        disabled={isSaving}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!data.students?.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-10 text-center text-slate-400 text-sm italic"
                    >
                      Chưa có học sinh nào trong danh sách.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}

        {activeTab === "attendance" && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Điểm danh lớp học
                </h3>
                <p className="text-xs text-slate-500">
                  Ghi nhận sự tham gia của học sinh theo buổi học
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    Ngày điểm danh
                  </label>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <Button className="gap-2" onClick={handleSaveAttendance}>
                  <Save size={18} /> Lưu kết quả
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {attendanceRecords.map((r, idx) => (
                <div
                  key={r.studentId}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:border-primary/20 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center font-bold border border-slate-100">
                      {r.fullName?.charAt(0)}
                    </div>
                    <span className="text-sm font-bold text-slate-700">
                      {r.fullName}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {["PRESENT", "ABSENT", "LATE", "EXCUSED"].map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          const newRecords = [...attendanceRecords];
                          newRecords[idx].status = status;
                          setAttendanceRecords(newRecords);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                          r.status === status
                            ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                            : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                        }`}
                      >
                        {status === "PRESENT"
                          ? "Có mặt"
                          : status === "ABSENT"
                            ? "Vắng"
                            : status === "LATE"
                              ? "Muộn"
                              : "Có phép"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === "results" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <SummaryCard
                title="Tổng học sinh"
                value={periodicComments.length}
                icon={Users}
              />
              <SummaryCard
                title="Đã nhận xét"
                value={periodicComments.filter((c) => c.comment).length}
                icon={CheckCircle2}
                color="text-green-600"
              />
              <SummaryCard
                title="Chưa nhận xét"
                value={periodicComments.filter((c) => !c.comment).length}
                icon={AlertCircle}
                color="text-orange-600"
              />
              <SummaryCard
                title="Gói cao cấp"
                value={
                  periodicComments.filter((c) => isPremiumPlan(c.contracts))
                    .length
                }
                icon={GraduationCap}
                color="text-purple-600"
              />
            </div>

            <Card className="p-4 bg-slate-50 border-slate-200">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                  <button
                    onClick={() => setPeriodType("WEEKLY")}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${periodType === "WEEKLY" ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
                  >
                    Theo Tuần
                  </button>
                  <button
                    onClick={() => setPeriodType("MONTHLY")}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${periodType === "MONTHLY" ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
                  >
                    Theo Tháng
                  </button>
                </div>

                <select
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 min-w-[200px]"
                  value={periodKey}
                  onChange={(e) => setPeriodKey(e.target.value)}
                >
                  {getPeriodOptions().map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <select
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 min-w-[180px]"
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                >
                  <option value="">Tất cả giáo viên</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
                    </option>
                  ))}
                </select>

                <div className="flex-1 min-w-[200px] relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    placeholder="Tìm học sinh..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    value={commentSearch}
                    onChange={(e) => setCommentSearch(e.target.value)}
                  />
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              {isCommentsLoading ? (
                <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
                  <Loader2 className="animate-spin" size={32} />
                  <p className="text-sm">Đang tải danh sách nhận xét...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="px-6 py-4">Học sinh</th>
                        <th className="px-6 py-4">Gói học</th>
                        <th className="px-6 py-4">Trạng thái</th>
                        <th className="px-6 py-4">Giáo viên</th>
                        <th className="px-6 py-4">Cập nhật</th>
                        <th className="px-6 py-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {periodicComments.map((item) => {
                        const isPremium = isPremiumPlan(item.contracts);
                        const hasComment = !!item.comment;
                        return (
                          <tr
                            key={item.studentId}
                            className="hover:bg-slate-50/30 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                                  {item.fullName?.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-700">
                                    {item.fullName}
                                  </p>
                                  <p className="text-[10px] font-mono text-slate-400 uppercase">
                                    {item.code}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {isPremium && (
                                <Badge
                                  variant="warning"
                                  className="text-[9px] uppercase tracking-tighter"
                                >
                                  Premium
                                </Badge>
                              )}
                              <p className="text-xs text-slate-500 mt-1 truncate max-w-[150px]">
                                {item.contracts?.[0]?.productName ||
                                  "Gói thường"}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              {hasComment ? (
                                <Badge
                                  variant="success"
                                  className="text-[9px] uppercase tracking-tighter gap-1"
                                >
                                  <CheckCircle2 size={10} /> Đã nhận xét
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] uppercase tracking-tighter text-slate-400 border-slate-200"
                                >
                                  Chưa nhận xét
                                </Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-600">
                              {item.comment?.teacher?.fullName || "-"}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400">
                              {hasComment
                                ? format(
                                    new Date(item.comment.updatedAt),
                                    "dd/MM/yyyy HH:mm",
                                  )
                                : "-"}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button
                                variant={hasComment ? "ghost" : "outline"}
                                size="sm"
                                className="h-8 text-xs font-bold"
                                onClick={() => handleOpenCommentModal(item)}
                              >
                                {hasComment ? "Sửa nhận xét" : "Thêm nhận xét"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {periodicComments.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-20 text-center text-slate-400 text-sm italic"
                          >
                            {data.students?.length === 0
                              ? "Lớp chưa có học sinh."
                              : "Không tìm thấy học sinh phù hợp."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={handleUpdateClass}
            className="w-full max-w-xl rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                Chỉnh sửa thông tin lớp
              </h2>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              <ClassEditField
                label="Tên lớp"
                value={editForm.name}
                onChange={(value) =>
                  setEditForm((form) => ({ ...form, name: value }))
                }
                required
              />
              <ClassEditField
                label="Mã lớp"
                value={editForm.code}
                onChange={(value) =>
                  setEditForm((form) => ({ ...form, code: value }))
                }
                required
              />
              <ClassEditField
                label="Sĩ số tối đa"
                type="number"
                value={editForm.capacity}
                onChange={(value) =>
                  setEditForm((form) => ({ ...form, capacity: value }))
                }
                required
              />
              <label className="text-sm text-slate-600">
                Trạng thái
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20"
                  value={editForm.status}
                  onChange={(event) =>
                    setEditForm((form) => ({
                      ...form,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="PLANNING">Đang lên kế hoạch</option>
                  <option value="ACTIVE">Đang học</option>
                  <option value="FINISHED">Đã kết thúc</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditModal(false)}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Đang lưu..." : "Lưu thông tin"}
              </Button>
            </div>
          </form>
        </div>
      )}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Thêm học sinh vào lớp
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tìm kiếm và chọn học sinh từ trung tâm
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEnrollModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  autoFocus
                  placeholder="Tìm theo tên, số điện thoại hoặc mã học sinh..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  value={searchKeyword}
                  onChange={(e) => {
                    setSearchKeyword(e.target.value);
                    setSelectedStudent(null);
                  }}
                />
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-2 min-h-[300px]">
                {searchError ? (
                  <div className="flex flex-col items-center justify-center py-20 text-red-500">
                    <AlertCircle size={32} className="mb-2" />
                    <p className="text-sm">{searchError}</p>
                  </div>
                ) : isSearching ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 size={32} className="animate-spin mb-2" />
                    <p className="text-sm">Đang tìm kiếm...</p>
                  </div>
                ) : availableStudents.length > 0 ? (
                  availableStudents.map((student: any) => {
                    const isSelected = selectedStudent?.id === student.id;
                    const isTransfer = student.classStudent?.length > 0;
                    const currentClassName =
                      student.classStudent?.[0]?.class?.name;

                    return (
                      <div
                        key={student.id}
                        onClick={() => setSelectedStudent(student)}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer group ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                            : "border-slate-50 bg-white hover:border-slate-200"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                isSelected
                                  ? "bg-primary text-white"
                                  : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                              }`}
                            >
                              {student.fullName?.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                {student.fullName}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs font-mono text-slate-500 uppercase">
                                  {student.code || "No Code"}
                                </span>
                                {student.studentPhone && (
                                  <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Phone size={10} /> {student.studentPhone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {student.status === "PENDING" && (
                              <Badge
                                variant="success"
                                className="text-[9px] uppercase tracking-wider px-1.5 py-0"
                              >
                                Chờ xếp lớp
                              </Badge>
                            )}
                            {isTransfer && (
                              <Badge
                                variant="outline"
                                className="text-[9px] uppercase tracking-wider px-1.5 py-0 border-orange-200 text-orange-600 bg-orange-50"
                              >
                                Lớp: {currentClassName}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : searchKeyword ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <p className="text-sm">Không tìm thấy học sinh phù hợp.</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEnrollModal(false)}
              >
                Hủy
              </Button>
              <Button
                type="button"
                disabled={isSaving || !selectedStudent}
                onClick={handleEnrollStudent}
                className="gap-2 min-w-[140px]"
              >
                {isSaving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : selectedStudent?.classStudent?.length > 0 ? (
                  <>
                    <ArrowRightLeft size={18} /> Chuyển vào lớp này
                  </>
                ) : (
                  <>
                    <Plus size={18} /> Thêm vào lớp
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCommentModal && activeCommentStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveComment}
            className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {activeCommentStudent.comment
                      ? "Cập nhật nhận xét"
                      : "Thêm nhận xét định kỳ"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {activeCommentStudent.fullName} •{" "}
                    {periodType === "WEEKLY" ? "Tuần" : "Tháng"} {periodKey}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCommentModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Giáo viên nhận xét
                  </label>
                  <select
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    value={commentForm.teacherId}
                    onChange={(e) =>
                      setCommentForm({
                        ...commentForm,
                        teacherId: e.target.value,
                      })
                    }
                  >
                    <option value="">Chọn giáo viên...</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Nội dung nhận xét chung <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  placeholder="Nhập nhận xét về tình hình học tập chung..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  value={commentForm.content}
                  onChange={(e) =>
                    setCommentForm({ ...commentForm, content: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-green-600 uppercase tracking-wider">
                    Điểm mạnh / Tiến bộ
                  </label>
                  <textarea
                    placeholder="Những điểm học sinh làm tốt..."
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none bg-green-50/20"
                    value={commentForm.strengths}
                    onChange={(e) =>
                      setCommentForm({
                        ...commentForm,
                        strengths: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-orange-600 uppercase tracking-wider">
                    Cần cải thiện
                  </label>
                  <textarea
                    placeholder="Những điểm cần lưu ý hoặc khắc phục..."
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none bg-orange-50/20"
                    value={commentForm.improvements}
                    onChange={(e) =>
                      setCommentForm({
                        ...commentForm,
                        improvements: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Định hướng / Bài tập tiếp theo
                </label>
                <textarea
                  placeholder="Kế hoạch học tập hoặc yêu cầu cho kỳ tiếp theo..."
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none bg-blue-50/20"
                  value={commentForm.nextSteps}
                  onChange={(e) =>
                    setCommentForm({ ...commentForm, nextSteps: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCommentModal(false)}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={
                  isSaving ||
                  !commentForm.content.trim() ||
                  !commentForm.teacherId
                }
              >
                {isSaving ? "Đang lưu..." : "Lưu nhận xét"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  color = "text-slate-900",
}: any) {
  const bgClass = color
    .replace("text-", "bg-")
    .replace("-600", "-100")
    .replace("-500", "-100");
  return (
    <Card className="p-5 flex items-center gap-4 border-none bg-white shadow-sm hover:shadow-md transition-shadow">
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bgClass} ${color}`}
      >
        <Icon size={24} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {title}
        </p>
        <p className={`text-2xl font-black ${color}`}>{value}</p>
      </div>
    </Card>
  );
}

function ClassEditField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm text-slate-600">
      {label}
      <input
        required={required}
        type={type}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}


function getClassStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PLANNING: "Đang lên kế hoạch",
    ACTIVE: "Đang học",
    FINISHED: "Đã kết thúc",
    CANCELLED: "Đã hủy",
  };
  return labels[status] || status;
}

function getStudentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Chờ xử lý",
    TRIAL: "Học thử",
    ACTIVE: "Đang học",
    HOLD: "Tạm dừng",
    COMPLETED: "Hoàn thành",
    DROPPED: "Đã nghỉ",
    RENEWAL_CANDIDATE: "Cần tái phí",
  };
  return labels[status] || status;
}
