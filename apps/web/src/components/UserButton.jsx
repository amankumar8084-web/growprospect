import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  LogOut, 
  ShieldCheck, 
  Shield, 
  UserCheck, 
  Building2, 
  ChevronDown,
  Check
} from 'lucide-react';

export default function UserButton() {
  const { user, role, orgId, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user) return null;

  const initials = (user.name || user.fullName || user.email || 'U')
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const roleBadgeColor = 
    role === 'admin' 
      ? 'bg-purple-100 text-purple-700 border-purple-200' 
      : role === 'manager' 
      ? 'bg-blue-100 text-blue-700 border-blue-200' 
      : 'bg-emerald-100 text-emerald-700 border-emerald-200';

  const roleIcon = 
    role === 'admin' 
      ? <ShieldCheck className="w-3 h-3 text-purple-600" /> 
      : role === 'manager' 
      ? <Shield className="w-3 h-3 text-blue-600" /> 
      : <UserCheck className="w-3 h-3 text-emerald-600" />;

  return (
    <div className="relative" ref={popoverRef}>
      {/* Avatar Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer group"
        title="Account & Profile"
      >
        <div className="w-8 h-8 rounded-full bg-linear-to-tr from-[#ea580c] to-[#f97316] text-white flex items-center justify-center font-bold text-xs ring-2 ring-gray-100 group-hover:ring-[#ea580c]/30 shadow-2xs">
          {initials}
        </div>
      </button>

      {/* Popover Dropdown Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans">
          
          {/* User Info Header */}
          <div className="p-4 bg-gray-50/70 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-linear-to-tr from-[#ea580c] to-[#f97316] text-white flex items-center justify-center font-bold text-sm shadow-2xs shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {user.name || user.fullName || 'User'}
                </p>
                <p className="text-[11px] text-gray-500 truncate mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>

            {/* Role & Org Badge */}
            <div className="mt-3 pt-2.5 border-t border-gray-200/60 flex items-center justify-between">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${roleBadgeColor}`}>
                {roleIcon}
                <span>{role}</span>
              </span>

              <span className="text-[10px] text-gray-400 font-mono truncate max-w-[120px]">
                {orgId}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-2">
            <button
              type="button"
              onClick={async () => {
                setIsOpen(false);
                await logout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
