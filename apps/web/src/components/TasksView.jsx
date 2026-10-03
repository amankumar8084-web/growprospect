import React, { useState, useEffect } from 'react';
import { crmService } from '../services/crmService';
import { sessionManager } from '../services/sessionManager';
import { soundService } from '../services/soundService';
import { 
  CheckSquare, 
  Square, 
  Calendar, 
  Clock, 
  Plus, 
  AlertCircle, 
  Filter, 
  CheckCircle2, 
  User, 
  X,
  ExternalLink,
  Bell,
  Mail,
  UserCheck,
  Settings2
} from 'lucide-react';

export default function TasksView({ onSelectLead, onTasksChanged }) {
  const currentUser = sessionManager.getSessionInfo()?.user;
  const currentUserId = currentUser?.id || 'usr_anonymous';
  const userRole = sessionManager.getRole();
  const isManagerOrAdmin = userRole === 'admin' || userRole === 'manager';

  const [tasks, setTasks] = useState([]);
  const [filterDue, setFilterDue] = useState('today'); // 'today', 'overdue', 'upcoming', 'all', 'done'
  const [scopeFilter, setScopeFilter] = useState('mine'); // 'mine' | 'team'
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reassigningTask, setReassigningTask] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Reminders state
  const [inAppReminder, setInAppReminder] = useState(() => {
    return localStorage.getItem('growprospect_task_reminders_inapp') !== 'false';
  });
  const [emailReminder, setEmailReminder] = useState(() => {
    return localStorage.getItem('growprospect_task_reminders_email') === 'true';
  });
  const [showReminderSettings, setShowReminderSettings] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleToggleInAppReminder = (val) => {
    setInAppReminder(val);
    localStorage.setItem('growprospect_task_reminders_inapp', String(val));
  };

  const handleToggleEmailReminder = (val) => {
    setEmailReminder(val);
    localStorage.setItem('growprospect_task_reminders_email', String(val));
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (filterDue === 'today') filters.due = 'today';
      if (filterDue === 'overdue') filters.due = 'overdue';
      if (filterDue === 'upcoming') filters.due = 'upcoming';
      if (filterDue === 'done') filters.done = true;

      if (scopeFilter === 'mine' || !isManagerOrAdmin) {
        filters.assignee_id = currentUserId;
      }

      const data = await crmService.getTasks(filters);
      setTasks(data);
      if (onTasksChanged) onTasksChanged();
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    crmService.getTeamMembers().then(setTeamMembers).catch(() => {});
  }, [filterDue, scopeFilter]);

  const handleToggleDone = async (task) => {
    const nextDone = !task.done;
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: nextDone } : t));
    if (nextDone) {
      soundService.playSuccessSound();
    } else {
      soundService.playPingSound();
    }
    try {
      await crmService.updateTask(task.id, { done: nextDone });
      if (onTasksChanged) onTasksChanged();
    } catch (err) {
      alert(`Error updating task: ${err.message}`);
      loadTasks();
    }
  };

  const handleReassign = async (taskId, newAssigneeId) => {
    if (!newAssigneeId) return;
    try {
      await crmService.updateTask(taskId, { assignee_id: newAssigneeId });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assignee_id: newAssigneeId } : t));
      setReassigningTask(null);
      if (onTasksChanged) onTasksChanged();
    } catch (err) {
      alert(`Failed to reassign task: ${err.message}`);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setSubmitting(true);
    try {
      await crmService.createTask({
        title: newTaskTitle.trim(),
        due_date: newTaskDueDate || null,
        assignee_id: newTaskAssignee || currentUserId
      });
      soundService.playSuccessSound();
      setIsModalOpen(false);
      setNewTaskTitle('');
      setNewTaskDueDate('');
      setNewTaskAssignee('');
      loadTasks();
    } catch (err) {
      alert(`Failed to create task: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Compute counts for tab badges
  const myDueTodayCount = tasks.filter(
    (t) => t.assignee_id === currentUserId && !t.done && t.due_date?.slice(0, 10) === todayStr
  ).length;

  const overdueCount = tasks.filter(
    (t) => !t.done && t.due_date && t.due_date.slice(0, 10) < todayStr
  ).length;

  const upcomingCount = tasks.filter(
    (t) => !t.done && t.due_date && t.due_date.slice(0, 10) > todayStr
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E7E7E7]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#111111] text-white">
              TASKS & FOLLOW-UPS
            </span>
            <span className="text-xs font-mono text-[#8A8A8A]">
              Team Execution Queue
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">
            Tasks & Action Items
          </h1>
          <p className="text-sm text-[#8A8A8A] mt-1 max-w-2xl">
            Track customer commitments, follow-up deadlines, and outreach tasks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowReminderSettings(!showReminderSettings)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#F5F5F5] border border-[#E7E7E7] text-[#111111] text-xs font-medium rounded-md shadow-2xs transition-colors cursor-pointer"
            title="Configure Task Reminders"
          >
            <Bell className="w-3.5 h-3.5 text-[#EA4B0B]" />
            <span>Reminders</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#EA4B0B] hover:bg-[#d03f07] text-white text-sm font-medium rounded-md shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Reminder Notification Banner */}
      {inAppReminder && myDueTodayCount > 0 && (
        <div className="p-3 bg-[#FFF5F0] border border-[#FFE0D2] rounded-lg flex items-center justify-between text-xs text-[#111111]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#EA4B0B] shrink-0 animate-pulse" />
            <div>
              <span className="font-semibold text-[#EA4B0B]">Due Today Alert:</span> You have{' '}
              <span className="font-bold">{myDueTodayCount}</span> task{myDueTodayCount > 1 ? 's' : ''} scheduled for today. Complete them to maintain deal velocity.
            </div>
          </div>
          <span className="text-[10px] font-mono text-[#8A8A8A] hidden sm:inline">
            In-app reminders active
          </span>
        </div>
      )}

      {/* Reminder Settings Dropdown Modal */}
      {showReminderSettings && (
        <div className="p-4 bg-[#FBFBFB] border border-[#E7E7E7] rounded-lg shadow-2xs space-y-3 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#E7E7E7]">
            <span className="font-semibold text-[#111111] flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-[#EA4B0B]" />
              Task Reminder Preferences
            </span>
            <button
              onClick={() => setShowReminderSettings(false)}
              className="text-[#8A8A8A] hover:text-[#111111]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center justify-between p-3 bg-white border border-[#E7E7E7] rounded-md cursor-pointer hover:border-[#111111]">
              <div className="space-y-0.5">
                <div className="font-medium text-[#111111] flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-[#EA4B0B]" />
                  <span>In-App Banner Notifications</span>
                </div>
                <div className="text-[11px] text-[#8A8A8A]">
                  Shows alert banner whenever tasks are due today
                </div>
              </div>
              <input
                type="checkbox"
                checked={inAppReminder}
                onChange={(e) => handleToggleInAppReminder(e.target.checked)}
                className="rounded border-[#E7E7E7] text-[#EA4B0B] focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-white border border-[#E7E7E7] rounded-md cursor-pointer hover:border-[#111111]">
              <div className="space-y-0.5">
                <div className="font-medium text-[#111111] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>Daily Morning Email Digest</span>
                </div>
                <div className="text-[11px] text-[#8A8A8A]">
                  Receive an 8:00 AM summary of pending tasks
                </div>
              </div>
              <input
                type="checkbox"
                checked={emailReminder}
                onChange={(e) => handleToggleEmailReminder(e.target.checked)}
                className="rounded border-[#E7E7E7] text-[#EA4B0B] focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </label>
          </div>
        </div>
      )}

      {/* Filter Tabs & Scope Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7E7E7] pb-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'today', label: 'Due Today', count: myDueTodayCount, highlight: myDueTodayCount > 0 },
            { id: 'overdue', label: 'Overdue', count: overdueCount, alert: overdueCount > 0 },
            { id: 'upcoming', label: 'Upcoming', count: upcomingCount },
            { id: 'all', label: 'All Tasks', count: tasks.length },
            { id: 'done', label: 'Completed' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterDue(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                filterDue === tab.id
                  ? 'bg-[#111111] text-white font-semibold'
                  : 'text-[#8A8A8A] hover:text-[#111111] hover:bg-[#F5F5F5]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  tab.highlight 
                    ? 'bg-[#EA4B0B] text-white' 
                    : tab.alert 
                    ? 'bg-rose-500 text-white'
                    : filterDue === tab.id ? 'bg-white/20 text-white' : 'bg-[#E7E7E7] text-[#111111]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {isManagerOrAdmin && (
          <div className="flex items-center bg-[#F5F5F5] border border-[#E7E7E7] rounded-md p-0.5">
            <button
              onClick={() => setScopeFilter('mine')}
              className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                scopeFilter === 'mine' ? 'bg-white text-[#111111] font-semibold shadow-2xs' : 'text-[#8A8A8A]'
              }`}
            >
              My Tasks
            </button>
            <button
              onClick={() => setScopeFilter('team')}
              className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                scopeFilter === 'team' ? 'bg-white text-[#111111] font-semibold shadow-2xs' : 'text-[#8A8A8A]'
              }`}
            >
              All Team Tasks
            </button>
          </div>
        )}
      </div>

      {/* Tasks List Table */}
      <div className="bg-white border border-[#E7E7E7] rounded-lg shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#8A8A8A] font-mono text-sm">
            Loading tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#F5F5F5] border border-[#E7E7E7] flex items-center justify-center mx-auto text-[#8A8A8A]">
              <CheckCircle2 className="w-6 h-6 text-[#8A8A8A]" />
            </div>
            <div>
              <p className="text-base font-bold text-[#111111]">No tasks found</p>
              <p className="text-xs text-[#8A8A8A] mt-1 max-w-sm mx-auto">
                {filterDue === 'today'
                  ? 'No tasks due today. Schedule upcoming outreach to keep your deals active.'
                  : filterDue === 'overdue'
                  ? 'Great job! You have zero overdue tasks.'
                  : 'You have no tasks in this view. Keep your deal momentum going by adding your next outreach or follow-up item.'}
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#EA4B0B] hover:bg-[#d03f07] text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Task</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#E7E7E7]">
            {tasks.map((task) => {
              const isOverdue = !task.done && task.due_date && task.due_date.slice(0, 10) < todayStr;
              const isToday = !task.done && task.due_date && task.due_date.slice(0, 10) === todayStr;
              const assigneeMember = teamMembers.find(m => m.user_id === task.assignee_id);
              const assigneeName = task.assignee_id === currentUserId ? 'You' : (assigneeMember?.name || task.assignee_id || 'Unassigned');

              return (
                <div
                  key={task.id}
                  className={`p-4 flex items-center justify-between gap-4 transition-colors hover:bg-[#FAFAFA] ${
                    task.done ? 'opacity-60 bg-[#FBFBFB]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => handleToggleDone(task)}
                      className="cursor-pointer text-[#8A8A8A] hover:text-[#111111] transition-colors"
                      title={task.done ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {task.done ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Square className="w-5 h-5 text-[#8A8A8A] hover:text-[#EA4B0B]" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${task.done ? 'line-through text-[#8A8A8A]' : 'text-[#111111]'}`}>
                        {task.title}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-[#8A8A8A] mt-1 font-mono">
                        {task.due_date && (
                          <span className={`flex items-center gap-1 ${
                            isOverdue ? 'text-rose-600 font-bold' : isToday ? 'text-[#EA4B0B] font-bold' : ''
                          }`}>
                            <Calendar className="w-3 h-3" />
                            <span>
                              {isToday ? 'Today' : isOverdue ? `Overdue (${task.due_date.slice(0, 10)})` : task.due_date.slice(0, 10)}
                            </span>
                          </span>
                        )}

                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{assigneeName}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Reassign action for Managers & Admins */}
                    {isManagerOrAdmin && (
                      <div className="relative">
                        {reassigningTask === task.id ? (
                          <div className="flex items-center gap-1">
                            <select
                              defaultValue={task.assignee_id || ''}
                              onChange={(e) => handleReassign(task.id, e.target.value)}
                              className="text-xs py-1 px-2 border border-[#111111] rounded bg-white text-[#111111] font-mono cursor-pointer"
                              autoFocus
                            >
                              <option value="" disabled>Select team member</option>
                              {teamMembers.map((m) => (
                                <option key={m.user_id} value={m.user_id}>
                                  {m.name} ({m.role})
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => setReassigningTask(null)}
                              className="p-1 text-[#8A8A8A] hover:text-[#111111]"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReassigningTask(task.id)}
                            className="text-xs font-mono text-[#8A8A8A] hover:text-[#111111] px-2 py-1 rounded hover:bg-[#F5F5F5] border border-transparent hover:border-[#E7E7E7] flex items-center gap-1 transition-colors cursor-pointer"
                            title="Reassign to another team member"
                          >
                            <UserCheck className="w-3 h-3 text-[#EA4B0B]" />
                            <span>Reassign</span>
                          </button>
                        )}
                      </div>
                    )}

                    {task.lead_id && (
                      <button
                        onClick={() => onSelectLead && onSelectLead({ id: task.lead_id })}
                        className="text-xs font-mono text-[#EA4B0B] hover:underline flex items-center gap-1"
                      >
                        <span>View Lead</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E7E7]">
              <h3 className="text-base font-bold text-[#111111]">Create New Task</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#8A8A8A] hover:text-[#111111]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-semibold text-[#111111] uppercase tracking-wider mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call decision-maker to confirm proposal"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full text-sm p-2.5 bg-[#F5F5F5] border border-[#E7E7E7] rounded-md focus:outline-none focus:border-[#111111]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-[#111111] uppercase tracking-wider mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="w-full text-sm p-2.5 bg-[#F5F5F5] border border-[#E7E7E7] rounded-md focus:outline-none focus:border-[#111111]"
                />
              </div>

              {teamMembers.length > 0 && (
                <div>
                  <label className="block text-xs font-mono font-semibold text-[#111111] uppercase tracking-wider mb-1">
                    Assignee
                  </label>
                  <select
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    className="w-full text-sm p-2.5 bg-[#F5F5F5] border border-[#E7E7E7] rounded-md focus:outline-none focus:border-[#111111]"
                  >
                    <option value="">Assign to Myself</option>
                    {teamMembers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E7E7]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#E7E7E7] text-sm font-medium rounded-md hover:bg-[#F5F5F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#EA4B0B] hover:bg-[#d03f07] text-white text-sm font-medium rounded-md cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
