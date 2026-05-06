'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';
import { useAppDialog } from '@/providers/AppDialogProvider';
import { 
  UserPlus, 
  Shield, 
  Mail, 
  MoreVertical,
  Plus,
  X,
  Check,
  Trash2,
  Edit2
} from 'lucide-react';

export default function UserManagementPage() {
  const { confirm } = useAppDialog();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    password: '',
    roleId: '',
    centerIds: [] as string[],
    roleAssignments: [] as Array<{ roleId: string; centerIds: string[] }>,
    isActive: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersData, rolesData, centersData] = await Promise.all([
        apiFetch('/admin/users'),
        apiFetch('/admin/roles'),
        apiFetch('/admin/centers')
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setCenters(centersData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (user: any = null) => {
    setFormError(null);
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        fullName: user.fullName,
        password: '', // Don't show password
        roleId: user.roleId,
        centerIds: user.centers?.map((c: any) => c.centerId) || [],
        roleAssignments: user.userRoles?.length
          ? user.userRoles.map((item: any) => ({
              roleId: item.roleId,
              centerIds: item.centers?.map((center: any) => center.centerId) || [],
            }))
          : [{ roleId: user.roleId, centerIds: user.centers?.map((c: any) => c.centerId) || [] }],
        isActive: user.isActive
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        fullName: '',
        password: '',
        roleId: roles[0]?.id || '',
        centerIds: [],
        roleAssignments: [{ roleId: roles[0]?.id || '', centerIds: [] }],
        isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setFormError(null);
    try {
      const url = editingUser ? `/admin/users/${editingUser.id}` : '/admin/users';
      const method = editingUser ? 'PATCH' : 'POST';
      
      const payload = {
        ...formData,
        roleId: formData.roleAssignments[0]?.roleId || formData.roleId,
        centerIds: formData.roleAssignments[0]?.centerIds || formData.centerIds,
        roleAssignments: formData.roleAssignments.filter((item) => item.roleId),
      };
      if (editingUser && !payload.password) delete (payload as any).password;

      const savedUser = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });
      
      setUsers((current) => {
        if (editingUser) {
          return current.map((user) => user.id === savedUser.id ? savedUser : user);
        }
        return [savedUser, ...current];
      });
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Không thể lưu người dùng');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Xóa người dùng?',
      message: 'Tài khoản này sẽ bị xóa khỏi hệ thống. Thao tác này không thể hoàn tác.',
      confirmLabel: 'Xóa người dùng',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
      setUsers((current) => current.filter((user) => user.id !== id));
    } catch (err: any) {
      setError(err.message || 'Không thể xóa người dùng');
    }
  };

  if (isLoading) return <div className="text-center py-20 text-slate-500">Đang tải dữ liệu...</div>;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý người dùng</h1>
          <p className="text-slate-500 mt-1">Quản lý tài khoản cán bộ và phân quyền chi nhánh.</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="flex gap-2">
          <UserPlus size={18} />
          Thêm người dùng
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      <Card className="overflow-hidden border-none shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Họ tên & Email</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vai trò</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Chi nhánh truy cập</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                        {user.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{user.fullName}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Mail size={12} /> {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-primary" />
                      <span className="text-sm font-medium text-slate-700">{user.role?.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {user.centers?.length > 0 ? (
                        user.centers.map((c: any) => (
                          <Badge key={c.centerId} variant="info" className="text-[10px]">
                            {c.center.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">Hệ thống (Toàn quyền)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={user.isActive ? 'success' : 'error'}>
                      {user.isActive ? 'Đang hoạt động' : 'Tạm khóa'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="outline" size="sm" onClick={() => handleOpenModal(user)} className="h-8 w-8 p-0">
                        <Edit2 size={14} />
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(user.id)} className="h-8 w-8 p-0">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">
                {editingUser ? 'Chỉnh sửa người dùng' : 'Thêm người dùng mới'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
               {formError && (
                 <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
                   {formError}
                 </div>
               )}
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Họ và tên</label>
                    <input 
                      required
                      type="text" 
                      value={formData.fullName}
                      onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                    <input 
                      required
                      type="email" 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
               </div>

               <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Mật khẩu {editingUser && '(Để trống nếu không đổi)'}</label>
                  <input 
                    required={!editingUser}
                    type="password" 
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                  />
               </div>

               <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Vai trò</label>
                  <select 
                    value={formData.roleId}
                    onChange={(e) => setFormData({
                      ...formData,
                      roleId: e.target.value,
                      roleAssignments: formData.roleAssignments.map((item, index) =>
                        index === 0 ? { ...item, roleId: e.target.value } : item,
                      ),
                    })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none bg-white font-medium text-slate-700"
                  >
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
               </div>

               <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Chi nhánh truy cập</label>
                  <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto p-1 scrollbar-custom">
                     {centers.map(center => (
                       <label key={center.id} className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                          <input 
                            type="checkbox" 
                            checked={formData.centerIds.includes(center.id)}
                            onChange={(e) => {
                              const ids = e.target.checked 
                                ? [...formData.centerIds, center.id]
                                : formData.centerIds.filter(id => id !== center.id);
                              setFormData({
                                ...formData,
                                centerIds: ids,
                                roleAssignments: formData.roleAssignments.map((item, index) =>
                                  index === 0 ? { ...item, centerIds: ids } : item,
                                ),
                              });
                            }}
                            className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                          />
                          <span className="text-xs font-medium text-slate-700 truncate">{center.name}</span>
                       </label>
                     ))}
                  </div>
               </div>

               <div className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase text-slate-500">Vai trò bổ sung</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData((current) => ({
                        ...current,
                        roleAssignments: [
                          ...current.roleAssignments,
                          { roleId: roles[0]?.id || '', centerIds: [] },
                        ],
                      }))}
                    >
                      <Plus size={14} /> Thêm
                    </Button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {formData.roleAssignments.slice(1).map((assignment, offset) => {
                      const index = offset + 1;
                      return (
                        <div key={index} className="rounded-lg bg-slate-50 p-3">
                          <div className="flex items-center gap-2">
                            <select
                              value={assignment.roleId}
                              onChange={(event) => {
                                const next = [...formData.roleAssignments];
                                next[index] = { ...assignment, roleId: event.target.value };
                                setFormData({ ...formData, roleAssignments: next });
                              }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                            >
                              {roles.map(role => (
                                <option key={role.id} value={role.id}>{role.name}</option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => setFormData((current) => ({
                                ...current,
                                roleAssignments: current.roleAssignments.filter((_, idx) => idx !== index),
                              }))}
                            >
                              <X size={14} />
                            </Button>
                          </div>
                          <div className="mt-2 grid max-h-28 grid-cols-2 gap-2 overflow-y-auto">
                            {centers.map(center => (
                              <label key={center.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 bg-white p-2">
                                <input
                                  type="checkbox"
                                  checked={assignment.centerIds.includes(center.id)}
                                  onChange={(event) => {
                                    const ids = event.target.checked
                                      ? [...assignment.centerIds, center.id]
                                      : assignment.centerIds.filter(id => id !== center.id);
                                    const next = [...formData.roleAssignments];
                                    next[index] = { ...assignment, centerIds: ids };
                                    setFormData({ ...formData, roleAssignments: next });
                                  }}
                                />
                                <span className="truncate text-xs">{center.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
               </div>

               <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    className="rounded border-slate-300 text-primary h-4 w-4"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-slate-700">Kích hoạt tài khoản</label>
               </div>

              </div>

               <div className="flex justify-end gap-3 border-t border-slate-100 bg-white p-4">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Hủy</Button>
                  <Button type="submit" isLoading={isSaving} className="min-w-[120px]">
                    Lưu thay đổi
                  </Button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
