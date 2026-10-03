import React, { useState, useEffect, useMemo } from 'react';
import { crmService } from '../services/crmService';
import { sessionManager } from '../services/sessionManager';
import { useUser, useAuth } from '../context/AuthContext';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  UserCheck, 
  User, 
  Search, 
  Plus, 
  Trash2, 
  X, 
  Mail, 
  Check, 
  AlertCircle, 
  ChevronDown,
  Shield,
  Clock,
  Sparkles,
  Filter
} from 'lucide-react';

export default function UserManagementView() {
  const { user: currentClerkUser } = useUser();
  const userRole = sessionManager.getRole();
  const isAdmin = userRole === 'admin';

  const [teamMembers, setTeamMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // New User Form State
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    role: 'rep'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load team members
  const loadTeam = async () => {
    setIsLoading(true);
    try {
      const members = await crmService.getTeamMembers();
      setTeamMembers(members || []);
    } catch (err) {
      console.error('Failed to load team members:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, []);

  // Filtered members
  const filteredMembers = useMemo(() => {
    return teamMembers.filter((member) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        member.name?.toLowerCase().includes(query) || 
        member.email?.toLowerCase().includes(query);
      
      const matchesRole = roleFilter === 'ALL' || (member.role || 'rep').toLowerCase() === roleFilter.toLowerCase();

      return matchesSearch && matchesRole;
    });
  }, [teamMembers, searchQuery, roleFilter]);

  // Counts summary
  const counts = useMemo(() => {
    const total = teamMembers.length;
    const admins = teamMembers.filter(m => (m.role || '').toLowerCase() === 'admin').length;
    const managers = teamMembers.filter(m => (m.role || '').toLowerCase() === 'manager').length;
    const reps = teamMembers.filter(m => (m.role || '').toLowerCase() === 'rep').length;
    return { total, admins, managers, reps };
  }, [teamMembers]);

  // Handle Add User
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUserForm.name.trim() || !newUserForm.email.trim()) {
      alert('Please fill in both Name and Email');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await crmService.inviteTeamMember({
        name: newUserForm.name.trim(),
        email: newUserForm.email.trim(),
        role: newUserForm.role
      });

      if (res && res.member) {
        setTeamMembers(prev => [...prev, res.member]);
      } else {
        await loadTeam();
      }

      setIsAddUserOpen(false);
      setNewUserForm({ name: '', email: '', role: 'rep' });
      setFeedback({ type: 'success', message: `User "${newUserForm.name}" created successfully!` });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create user' });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Role Change
  const handleRoleChange = async (userId, newRole) => {
    try {
      await crmService.updateMemberRole(userId, newRole);
      setTeamMembers(prev => prev.map(m => m.user_id === userId || m.id === userId ? { ...m, role: newRole } : m));
      setFeedback({ type: 'success', message: 'User role updated successfully' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      alert('Failed to update role: ' + err.message);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (userId, name) => {
    if (!window.confirm(`Are you sure you want to remove ${name || 'this user'}?`)) return;

    try {
      await crmService.deleteTeamMember(userId);
      setTeamMembers(prev => prev.filter(m => m.user_id !== userId && m.id !== userId));
      setFeedback({ type: 'success', message: `User "${name}" removed successfully` });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      alert('Failed to remove user: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            User Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Manage team members, roles, permissions, and create new users.
          </p>
        </div>

        <div>
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4 KPI Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Total Users */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow flex flex-col justify-between min-h-[110px]">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              TOTAL USERS
            </span>
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 leading-none my-1">
            {counts.total}
          </div>
          <div className="text-[11px] text-gray-400 font-normal">Active team members</div>
        </div>

        {/* Administrators */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow flex flex-col justify-between min-h-[110px]">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              ADMINS
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-purple-600 leading-none my-1">
            {counts.admins}
          </div>
          <div className="text-[11px] text-purple-600 font-semibold">Full access & control</div>
        </div>

        {/* Managers */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow flex flex-col justify-between min-h-[110px]">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              MANAGERS
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-blue-600 leading-none my-1">
            {counts.managers}
          </div>
          <div className="text-[11px] text-blue-600 font-semibold">Team & pipeline ops</div>
        </div>

        {/* Sales Reps */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow flex flex-col justify-between min-h-[110px]">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              SALES REPS
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-[#ea580c]">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#ea580c] leading-none my-1">
            {counts.reps}
          </div>
          <div className="text-[11px] text-gray-400 font-normal">Deal outreach & leads</div>
        </div>
      </div>

      {/* Main Card: Search, Filter & User Table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-gray-400 focus:outline-none transition-all placeholder:text-gray-400 text-gray-800"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-gray-400 flex items-center gap-1 font-medium">
              <Filter className="w-3.5 h-3.5" />
              Role:
            </span>
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-0.5 text-xs">
              {['ALL', 'admin', 'manager', 'rep'].map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-3 py-1 rounded-md transition-all capitalize cursor-pointer ${
                    roleFilter === role 
                      ? 'bg-white text-gray-900 font-semibold shadow-xs' 
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {role === 'ALL' ? 'All Roles' : role}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-5">User</th>
                <th className="py-3 px-5">Email Address</th>
                <th className="py-3 px-5">Role</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#ea580c] border-t-transparent rounded-full animate-spin" />
                      <span>Loading team users...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="font-semibold text-gray-700">No users found</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Try adjusting your search or create a new user.</p>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const role = (member.role || 'rep').toLowerCase();
                  const isCurrent = currentClerkUser?.primaryEmailAddress?.emailAddress === member.email;

                  return (
                    <tr key={member.user_id || member.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {(member.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 flex items-center gap-1.5">
                              <span>{member.name || 'Team User'}</span>
                              {isCurrent && (
                                <span className="text-[10px] bg-orange-50 text-[#ea580c] border border-orange-200 px-1.5 py-0.2 rounded font-semibold">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 font-normal">
                              User ID: {member.user_id || member.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-5 font-normal text-gray-600">
                        {member.email}
                      </td>

                      {/* Role Selector / Badge */}
                      <td className="py-3.5 px-5">
                        {isAdmin && !isCurrent ? (
                          <select
                            value={role}
                            onChange={(e) => handleRoleChange(member.user_id || member.id, e.target.value)}
                            className="px-2.5 py-1 text-xs bg-gray-50 border border-gray-200 rounded-lg font-semibold text-gray-700 focus:bg-white focus:border-[#ea580c] focus:outline-none transition-all cursor-pointer"
                          >
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="rep">Sales Rep</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            role === 'admin' 
                              ? 'bg-purple-50 text-purple-700 border-purple-200' 
                              : role === 'manager' 
                                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                : 'bg-orange-50 text-[#ea580c] border-orange-200'
                          }`}>
                            {role === 'admin' ? 'Administrator' : role === 'manager' ? 'Manager' : 'Sales Rep'}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        {!isCurrent && (
                          <button
                            onClick={() => handleDeleteUser(member.user_id || member.id, member.name)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-[#ea580c]">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Create New User</h3>
                  <p className="text-xs text-gray-400">Add a new member to your workspace</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-[#ea580c] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    placeholder="john@growprospect.local"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-[#ea580c] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Access Role <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'rep', title: 'Sales Rep', desc: 'Can view and work on assigned or unassigned leads.' },
                    { id: 'manager', title: 'Manager', desc: 'Can assign leads, view all team activity, and pipeline reports.' },
                    { id: 'admin', title: 'Administrator', desc: 'Full permissions including user creation, roles, and governance.' }
                  ].map((r) => (
                    <label
                      key={r.id}
                      onClick={() => setNewUserForm({ ...newUserForm, role: r.id })}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        newUserForm.role === r.id 
                          ? 'border-[#ea580c] bg-orange-50/40 ring-1 ring-[#ea580c]' 
                          : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="userRole"
                        checked={newUserForm.role === r.id}
                        onChange={() => {}}
                        className="mt-0.5 text-[#ea580c] focus:ring-[#ea580c]"
                      />
                      <div>
                        <div className="text-xs font-bold text-gray-900">{r.title}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{r.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
