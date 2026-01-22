import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download, Plus, Edit, Trash2, Eye, Mail, Phone, BookOpen, CheckCircle, XCircle, MoreVertical, UserPlus, Users as UsersIcon } from 'lucide-react';
import { User } from '../../types/lms';
import { AssignCoursesModal } from './AssignCoursesModal';
import { usersService } from '../../services/users';
import { coursesService } from '../../services/courses';
import { certificatesService } from '../../services/certificates';
import { examsService } from '../../services/exams';
import { ApiError } from '../../services/api';
import { TablePagination } from '../ui/TablePagination';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface UserManagementProps {
  onCreate: () => void;
  onEdit: (user: any) => void;
  refreshTrigger?: number;
}

export function UserManagement({ onCreate, onEdit, refreshTrigger }: UserManagementProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [userToAssignCourses, setUserToAssignCourses] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<{ count: number; next: string | null; previous: string | null }>({
    count: 0,
    next: null,
    previous: null,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        page_size: pageSize,
      };
      if (filterRole !== 'all') {
        params.role = filterRole;
      }
      if (filterStatus !== 'all') {
        if (filterStatus === 'verified') {
          params.verified = true;
        } else if (filterStatus === 'unverified') {
          params.verified = false;
        } else if (filterStatus === 'active') {
          params.is_active = true;
        } else if (filterStatus === 'inactive') {
          params.is_active = false;
        }
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      const data = await usersService.getUsers(params);
      setUsers(data.results);
      setPagination({
        count: data.count,
        next: data.next,
        previous: data.previous,
      });
      setError(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('admin.users.loadError');
      setError(message);
      console.error('Failed to fetch users:', err);
      setUsers([]);
      setPagination({ count: 0, next: null, previous: null });
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, filterRole, filterStatus, searchQuery]);

  // Сбрасываем страницу при изменении фильтров
  useEffect(() => {
    setCurrentPage(1);
  }, [filterRole, filterStatus, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, refreshTrigger]);


  const handleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  };

  const handleSelectUser = (userId: string) => {
    if (selectedUsers.has(userId)) {
      setSelectedUsers(new Set([...selectedUsers].filter(id => id !== userId)));
    } else {
      setSelectedUsers(new Set([...selectedUsers, userId]));
    }
  };
  
  const totalPages = pagination.count ? Math.ceil(pagination.count / pageSize) : 1;

  const getRoleName = (role: string) => {
    const roles: Record<string, string> = {
      'student': t('forms.login.studentRole'),
      'pdek_member': t('forms.login.pdekMemberRole'),
      'pdek_chairman': t('forms.login.pdekChairmanRole'),
      'teacher': t('admin.users.teacher'),
      'admin': t('forms.login.adminRole'),
    };
    return roles[role] || role;
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      'student': 'bg-blue-100 text-blue-700',
      'pdek_member': 'bg-purple-100 text-purple-700',
      'pdek_chairman': 'bg-red-100 text-red-700',
      'teacher': 'bg-green-100 text-green-700',
      'admin': 'bg-gray-100 text-gray-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('admin.users.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">{t('admin.users.loadError')}: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('admin.users.totalUsers')}</p>
              <p className="text-3xl font-bold text-gray-900">{users.length}</p>
            </div>
            <UsersIcon className="w-12 h-12 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('admin.users.activeStudents')}</p>
              <p className="text-3xl font-bold text-green-600">
                {users.filter(u => u.role === 'student' && u.verified).length}
              </p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('admin.users.pdekMembers')}</p>
              <p className="text-3xl font-bold text-purple-600">
                {users.filter(u => u.role === 'pdek_member' || u.role === 'pdek_chairman').length}
              </p>
            </div>
            <UsersIcon className="w-12 h-12 text-purple-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('admin.users.pendingVerification')}</p>
              <p className="text-3xl font-bold text-orange-600">
                {users.filter(u => !u.verified).length}
              </p>
            </div>
            <XCircle className="w-12 h-12 text-orange-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">{t('admin.users.management')}</h2>
            <div className="flex gap-3">
              <button 
                onClick={async () => {
                  try {
                    const blob = await usersService.exportUsers();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `users_${new Date().toISOString().split('T')[0]}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    toast.success(t('admin.users.exportSuccess'));
                  } catch (error: any) {
                    const message = error instanceof ApiError ? error.message : t('admin.users.exportError');
                    toast.error(message);
                    console.error('Failed to export users:', error);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                {t('admin.users.export')}
              </button>
              <button 
                onClick={onCreate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('admin.users.addUser')}
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('admin.users.searchPlaceholder')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                showFilters ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              {t('common.filters')}
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.users.role')}</label>
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">{t('admin.users.allRoles')}</option>
                    <option value="student">{t('admin.users.students')}</option>
                    <option value="pdek_member">{t('admin.users.pdekMembersFilter')}</option>
                    <option value="pdek_chairman">{t('admin.users.pdekChairmen')}</option>
                    <option value="teacher">{t('admin.users.teachers')}</option>
                    <option value="admin">{t('admin.users.admins')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.status')}</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">{t('admin.users.allStatuses')}</option>
                    <option value="active">{t('common.active')}</option>
                    <option value="inactive">{t('common.inactive')}</option>
                    <option value="verified">{t('admin.users.verified')}</option>
                    <option value="unverified">{t('admin.users.unverified')}</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button 
                    onClick={() => {
                      setFilterRole('all');
                      setFilterStatus('all');
                      setSearchQuery('');
                    }}
                    className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors"
                  >
                    {t('admin.users.resetFilters')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedUsers.size > 0 && (
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">
                {t('admin.users.selected', { count: selectedUsers.size })}
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setUserToAssignCourses({ id: 'bulk' } as User);
                  }}
                  className="px-3 py-1 text-sm bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-50 transition-colors"
                >
                  {t('admin.users.assignToCourse')}
                </button>
                <button 
                  onClick={() => {
                    toast.info(t('admin.users.messageFeatureNotImplemented'));
                  }}
                  className="px-3 py-1 text-sm bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-50 transition-colors"
                >
                  {t('admin.users.sendMessage')}
                </button>
                <button 
                  onClick={async () => {
                    if (!window.confirm(t('admin.users.deleteConfirm', { count: selectedUsers.size }))) {
                      return;
                    }
                    try {
                      await Promise.all(Array.from(selectedUsers).map(userId => usersService.deleteUser(userId)));
                      toast.success(t('admin.users.deleteSuccess', { count: selectedUsers.size }));
                      setSelectedUsers(new Set());
                      fetchUsers();
                    } catch (error: any) {
                      const message = error instanceof ApiError ? error.message : t('admin.users.deleteError');
                      toast.error(message);
                      console.error('Failed to delete users:', error);
                    }
                  }}
                  className="px-3 py-1 text-sm bg-white border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4">
                  <input
                    type="checkbox"
                    checked={selectedUsers.size === users.length && users.length > 0}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.users.user')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.users.contacts')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.users.role')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.users.organization')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.users.courses')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.users.progress')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('common.status')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-4">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => handleSelectUser(user.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium text-gray-900">{user.full_name || user.fullName || t('admin.users.unknown')}</div>
                        <div className="text-xs text-gray-500">
                          {user.iin && `${t('lms.pdek.iin')}: ${user.iin}`}
                          {user.created_at && ` • ${new Date(user.created_at).toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-3 h-3" />
                        {user.email || '—'}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-3 h-3" />
                        {user.phone || '—'}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${getRoleBadgeColor(user.role)}`}>
                      {getRoleName(user.role)}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{user.organization || user.company || '—'}</div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-sm text-gray-500">—</div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-gray-400">—</span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-col gap-2">
                      {/* Статус активности */}
                      {user.is_active !== false ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded w-fit">
                          <CheckCircle className="w-3 h-3" />
                          {t('common.active')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded w-fit">
                          <XCircle className="w-3 h-3" />
                          {t('common.inactive')}
                        </span>
                      )}
                      {/* Статус подтверждения */}
                      {user.verified ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded w-fit">
                          <CheckCircle className="w-3 h-3" />
                          {t('admin.users.verified')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded w-fit">
                          <XCircle className="w-3 h-3" />
                          {t('admin.users.unverified')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setSelectedUser(user)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t('common.view')}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onEdit(user)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title={t('common.edit')}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={async () => {
                          const userName = user.full_name || user.fullName || t('admin.users.userLower');
                          if (window.confirm(t('admin.users.deleteUserConfirm', { name: userName }))) {
                            try {
                              await usersService.deleteUser(user.id);
                              // Обновляем список пользователей
                              fetchUsers();
                            } catch (error: any) {
                              alert(`${t('common.error')}: ${error.message || t('admin.users.deleteUserError')}`);
                            }
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && !loading && (
            <div className="text-center py-12">
              <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t('admin.users.noUsersFound')}</p>
              <p className="text-sm text-gray-400 mt-1">{t('admin.users.tryChangingSearch')}</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.count > 0 && (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalCount={pagination.count}
            pageSize={pageSize}
          />
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)}
          onEdit={() => {
            onEdit(selectedUser);
            setSelectedUser(null);
          }}
          onDelete={async () => {
            const userName = selectedUser.full_name || selectedUser.fullName || t('admin.users.userLower');
            if (window.confirm(t('admin.users.deleteUserConfirmFull', { name: userName }))) {
              try {
                await usersService.deleteUser(selectedUser.id);
                toast.success(t('admin.users.userDeletedSuccess'));
                setSelectedUser(null);
                fetchUsers();
              } catch (error: any) {
                toast.error(`${t('common.error')}: ${error.message || t('admin.users.deleteUserError')}`);
              }
            }
          }}
        />
      )}

      {/* Assign Courses Modal */}
      {userToAssignCourses && (
        <AssignCoursesModal
          user={userToAssignCourses.id === 'bulk' ? undefined : userToAssignCourses}
          users={userToAssignCourses.id === 'bulk' ? Array.from(selectedUsers).map(id => users.find(u => u.id === id)).filter(Boolean) as User[] : undefined}
          onClose={() => {
            setUserToAssignCourses(null);
            setSelectedUsers(new Set());
          }}
          onAssign={async (userIds: string[], courseIds: string[], deadline?: string) => {
            if (!userIds || userIds.length === 0) {
              toast.error(t('admin.users.noUsersSelected'));
              return;
            }
            if (!courseIds || courseIds.length === 0) {
              toast.error(t('admin.users.noCoursesSelected'));
              return;
            }
            try {
              let successCount = 0;
              let errorCount = 0;
              for (const courseId of courseIds) {
                try {
                  await coursesService.enrollStudents(courseId, userIds);
                  successCount++;
                } catch (err) {
                  errorCount++;
                  console.error(`Failed to enroll users in course ${courseId}:`, err);
                }
              }
              if (successCount > 0) {
                toast.success(t('admin.users.coursesAssigned', { courses: successCount, users: userIds.length, errors: errorCount > 0 ? ` (${t('common.error')}: ${errorCount})` : '' }));
              } else {
                toast.error(t('admin.users.assignCoursesError'));
              }
              setUserToAssignCourses(null);
              setSelectedUsers(new Set());
              fetchUsers();
            } catch (error: any) {
              const message = error instanceof ApiError ? error.message : t('admin.users.assignCoursesError');
              toast.error(message);
              console.error('Failed to assign courses:', error);
            }
          }}
        />
      )}
    </div>
  );
}

// User Detail Modal
interface UserDetailModalProps {
  user: any;
  onClose: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}

function UserDetailModal({ user, onClose, onEdit, onDelete }: UserDetailModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'info' | 'courses' | 'activity'>('info');
  const [showAssignCourses, setShowAssignCourses] = useState(false);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);

  // Функция для получения текста статуса
  const getStatusText = (status: string): string => {
    const statusMap: Record<string, string> = {
      'assigned': t('lms.student.status.assigned'),
      'in_progress': t('lms.student.status.inProgress'),
      'exam_available': t('lms.student.status.examAvailable'),
      'exam_passed': t('lms.student.status.examPassed'),
      'completed': t('lms.student.status.completed'),
      'failed': t('admin.users.failed'),
      'annulled': t('admin.users.annulled'),
    };
    return statusMap[status] || status;
  };

  useEffect(() => {
    if (activeTab === 'courses' || activeTab === 'info') {
      const fetchUserData = async () => {
        try {
          setLoading(true);
          // Получаем все курсы и фильтруем по пользователю
          const coursesResponse = await coursesService.getCourses({ page_size: 1000 });
          const allCourses = coursesResponse.results;
          const allEnrollments: any[] = [];
          
          for (const course of allCourses) {
            try {
              const courseStudents = await coursesService.getCourseStudents(course.id);
              const userEnrollment = courseStudents.find((e: any) => {
                const student = e.student || e;
                return (student.id || student) === user.id;
              });
              if (userEnrollment) {
                allEnrollments.push({
                  ...userEnrollment,
                  course: course,
                });
              }
            } catch (err) {
              // Игнорируем ошибки для отдельных курсов
            }
          }
          
          setEnrollments(allEnrollments);
          
          // Получаем сертификаты пользователя
          try {
            const allCertificates = await certificatesService.getCertificates();
            // Убеждаемся, что allCertificates - это массив
            const certificatesArray = Array.isArray(allCertificates) ? allCertificates : [];
            const userCerts = certificatesArray.filter((c: any) => {
              const certUser = c.user || c.student;
              return (certUser?.id || certUser) === user.id;
            });
            setCertificates(userCerts);
          } catch (err) {
            console.error('Failed to fetch certificates:', err);
            setCertificates([]); // Устанавливаем пустой массив при ошибке
          }
          
          // Попытки тестов - пока не доступны для конкретного пользователя через API
          // Можно добавить endpoint для получения попыток пользователя
        } catch (error) {
          console.error('Failed to fetch user data:', error);
        } finally {
          setLoading(false);
        }
      };
      
      fetchUserData();
    }
  }, [user.id, activeTab]);

  const handleAssignCourses = async (userIds: string[], courseIds: string[], deadline?: string) => {
    if (!userIds || userIds.length === 0) {
      toast.error(t('admin.users.noUsersSelected'));
      return;
    }
    if (!courseIds || courseIds.length === 0) {
      toast.error(t('admin.users.noCoursesSelected'));
      return;
    }
    try {
      let successCount = 0;
      let errorCount = 0;
      for (const courseId of courseIds) {
        try {
          await coursesService.enrollStudents(courseId, userIds);
          successCount++;
        } catch (err) {
          errorCount++;
          console.error(`Failed to enroll users in course ${courseId}:`, err);
        }
      }
      if (successCount > 0) {
        toast.success(t('admin.users.coursesAssignedToUser', { courses: successCount, user: user.full_name || user.fullName || t('admin.users.userLower'), errors: errorCount > 0 ? ` (${t('common.error')}: ${errorCount})` : '' }));
      } else {
        toast.error(t('admin.users.assignCoursesError'));
        return;
      }
      setShowAssignCourses(false);
      // Обновляем список enrollments
      try {
        const coursesResponse = await coursesService.getCourses({ page_size: 1000 });
        const allCourses = coursesResponse.results;
        const allEnrollments: any[] = [];
        for (const course of allCourses) {
          try {
            const courseStudents = await coursesService.getCourseStudents(course.id);
            const userEnrollment = courseStudents.find((e: any) => {
              const student = e.student || e;
              return (student.id || student) === user.id;
            });
            if (userEnrollment) {
              allEnrollments.push({
                ...userEnrollment,
                course: course,
              });
            }
          } catch (err) {
            // Игнорируем ошибки для отдельных курсов
            console.warn(`Failed to fetch students for course ${course.id}:`, err);
          }
        }
        setEnrollments(allEnrollments);
      } catch (err) {
        console.error('Failed to refresh enrollments:', err);
      }
    } catch (error: any) {
      const message = error instanceof ApiError ? error.message : t('admin.users.assignCoursesError');
      toast.error(message);
      console.error('Failed to assign courses:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl ring-4 ring-white ring-opacity-50 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {(() => {
                  const name = user.full_name || user.fullName || '';
                  if (!name) return 'NN';
                  const parts = name.split(' ').filter(Boolean);
                  if (parts.length === 0) return 'NN';
                  const initials = parts.map((n: string) => n[0] || '').join('').substring(0, 2).toUpperCase();
                  return initials || 'NN';
                })()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{user.full_name || user.fullName || t('admin.users.unknown')}</h2>
                <p className="text-sm text-gray-600">{user.email || t('admin.users.noEmail')}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => setActiveTab('info')}
              className={`pb-2 px-1 border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('admin.users.info')}
            </button>
            <button
              onClick={() => setActiveTab('courses')}
              className={`pb-2 px-1 border-b-2 transition-colors ${
                activeTab === 'courses'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('admin.users.courses')} ({enrollments.length})
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`pb-2 px-1 border-b-2 transition-colors ${
                activeTab === 'activity'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('admin.users.activity')}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold text-gray-900 mb-4">{t('admin.users.personalData')}</h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm text-gray-600">{t('lms.pdek.iin')}</dt>
                      <dd className="text-sm font-medium text-gray-900">{user.iin}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-600">{t('forms.login.phone')}</dt>
                      <dd className="text-sm font-medium text-gray-900">{user.phone}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-600">Email</dt>
                      <dd className="text-sm font-medium text-gray-900">{user.email}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 mb-4">{t('admin.users.workplace')}</h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm text-gray-600">{t('admin.users.organization')}</dt>
                      <dd className="text-sm font-medium text-gray-900">{user.organization || user.company || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-600">{t('admin.users.city')}</dt>
                      <dd className="text-sm font-medium text-gray-900">{user.city || '—'}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-4">{t('admin.users.learningStats')}</h3>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">{t('admin.users.loadingStats')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-600 mb-1">{t('admin.users.coursesAssignedStat')}</p>
                      <p className="text-2xl font-bold text-blue-700">{enrollments.length}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-green-600 mb-1">{t('admin.users.completed')}</p>
                      <p className="text-2xl font-bold text-green-700">
                        {enrollments.filter(e => e.status === 'completed' || e.status === 'exam_passed').length}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-purple-600 mb-1">{t('admin.users.averageScore')}</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {enrollments.length > 0
                          ? Math.round(enrollments.reduce((sum, e) => {
                              // Используем прогресс как приблизительную оценку
                              const testScore = e.test_score || e.score || 0;
                              return sum + (testScore > 0 ? testScore : e.progress || 0);
                            }, 0) / enrollments.length)
                          : 0}%
                      </p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <p className="text-sm text-orange-600 mb-1">{t('admin.users.certificates')}</p>
                      <p className="text-2xl font-bold text-orange-700">{certificates.length}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'courses' && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900">{t('admin.users.assignedCourses')}</h3>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">{t('admin.users.loadingCourses')}</p>
                </div>
              ) : enrollments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>{t('admin.users.noAssignedCourses')}</p>
                </div>
              ) : (
                enrollments.map((enrollment) => {
                  const course = enrollment.course || {};
                  const progress = enrollment.progress || 0;
                  const status = enrollment.status || 'assigned';
                  const student = enrollment.student || enrollment.user || enrollment;
                  const userId = student?.id || enrollment.user?.id || enrollment.user || user.id;
                  
                  return (
                    <div key={enrollment.id || course.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{course.title || t('admin.users.unknownCourse')}</h4>
                        <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          status === 'completed' || status === 'exam_passed'
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {status === 'completed' || status === 'exam_passed' ? t('lms.student.status.completed') : getStatusText(status)}
                        </span>
                          <button
                            onClick={async () => {
                              const courseTitle = course.title || t('admin.users.courseLower');
                              if (window.confirm(t('admin.users.revokeCourseConfirm', { course: courseTitle, user: user.full_name || user.fullName || t('admin.users.userLower') }))) {
                                try {
                                  await coursesService.revokeEnrollment(course.id, userId);
                                  toast.success(t('admin.users.courseRevoked'));
                                  // Обновляем список курсов
                                  const coursesResponse = await coursesService.getCourses({ page_size: 1000 });
                                  const allCourses = coursesResponse.results;
                                  const allEnrollments: any[] = [];
                                  
                                  for (const c of allCourses) {
                                    try {
                                      const courseStudents = await coursesService.getCourseStudents(c.id);
                                      const userEnrollment = courseStudents.find((e: any) => {
                                        const s = e.student || e;
                                        return (s.id || s) === user.id;
                                      });
                                      if (userEnrollment) {
                                        allEnrollments.push({
                                          ...userEnrollment,
                                          course: c,
                                        });
                                      }
                                    } catch (err) {
                                      // Игнорируем ошибки для отдельных курсов
                                    }
                                  }
                                  
                                  setEnrollments(allEnrollments);
                                } catch (error: any) {
                                  toast.error(`${t('common.error')}: ${error.message || t('admin.users.revokeCourseError')}`);
                                }
                              }
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={t('admin.users.revokeCourse')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div 
                          className={`h-2 rounded-full ${
                            progress === 100 ? 'bg-green-600' : 'bg-blue-600'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{progress}% {t('admin.users.completedLower')}</span>
                        {enrollment.enrolled_at && (
                          <span className="text-gray-500">
                            {t('admin.users.enrolled')}: {new Date(enrollment.enrolled_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900">{t('admin.users.activityHistory')}</h3>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">{t('admin.users.loadingActivity')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {attempts.length === 0 && certificates.length === 0 && enrollments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>{t('admin.users.noActivityData')}</p>
                    </div>
                  ) : (
                    <>
                      {/* Certificates */}
                      {certificates.map((cert) => (
                        <div key={cert.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                          <div className="w-2 h-2 bg-green-600 rounded-full mt-2" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{t('admin.users.receivedCertificate')}</p>
                            <p className="text-sm text-gray-600">
                              {cert.course?.title || cert.courseName || t('admin.users.courseLower')}
                            </p>
                          </div>
                          {cert.issued_at && (
                            <span className="text-xs text-gray-500">
                              {new Date(cert.issued_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                      
                      {/* Course Completions */}
                      {enrollments
                        .filter(e => e.status === 'completed' || e.status === 'exam_passed')
                        .map((enrollment) => (
                          <div key={enrollment.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                            <div className="w-2 h-2 bg-purple-600 rounded-full mt-2" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{t('admin.users.completedCourse')}</p>
                              <p className="text-sm text-gray-600">
                                {(enrollment.course || {}).title || t('admin.users.courseLower')}
                              </p>
                            </div>
                            {enrollment.completed_at && (
                              <span className="text-xs text-gray-500">
                                {new Date(enrollment.completed_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowAssignCourses(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              {t('admin.users.assignCourses')}
            </button>
            <div className="flex items-center gap-3">
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('common.delete')}
                </button>
              )}
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('common.close')}
              </button>
              <button
                onClick={onEdit}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('common.edit')}
              </button>
            </div>
          </div>
        </div>

        {/* Assign Courses Modal (nested) */}
        {showAssignCourses && (
          <div className="absolute inset-0 z-10">
            <AssignCoursesModal
              user={user}
              onClose={() => setShowAssignCourses(false)}
              onAssign={handleAssignCourses}
            />
          </div>
        )}
      </div>
    </div>
  );
}