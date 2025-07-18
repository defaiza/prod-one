"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Document, ObjectId } from 'mongodb';
import UserDetailsModal from '@/components/admin/UserDetailsModal';
import ConfirmationModal from '@/components/admin/ConfirmationModal';
import CreateUserModal from '@/components/admin/CreateUserModal';

export interface UserRow {
  _id?: string | ObjectId;
  walletAddress?: string;
  xUsername?: string;
  points?: number;
  role?: string;
  squadId?: string;
}

export interface AdminAuditLog extends Document {
  timestamp: Date;
  adminUserId: string;
  action: string;
  targetEntityType: string;
  targetEntityId: string;
  changes?: any;
  reason?: string;
  ipAddress?: string;
}

export interface ActionLogEntry {
    _id: string | ObjectId;
    walletAddress: string;
    actionType: string;
    pointsAwarded?: number;
    timestamp: Date;
    notes?: string;
}

export interface NotificationLogEntry {
    _id: string | ObjectId;
    userId: string | ObjectId;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
    ctaUrl?: string;
}

export interface FullUserDetail extends UserRow {
    _id?: string | ObjectId;
    referralCode?: string;
    referredBy?: string;
    completedActions?: string[];
    createdAt?: Date;
    updatedAt?: Date;
    recentActions?: ActionLogEntry[];
    recentNotifications?: NotificationLogEntry[];
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<FullUserDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // State for purge confirmation modal
  const [isPurgeConfirmModalOpen, setIsPurgeConfirmModalOpen] = useState(false);
  const [userToPurge, setUserToPurge] = useState<UserRow | null>(null);
  const [isPurging, setIsPurging] = useState(false);

  // New state for filters
  const [roleFilter, setRoleFilter] = useState('');
  const [squadIdFilter, setSquadIdFilter] = useState('');
  const [hasSquadFilter, setHasSquadFilter] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(25);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchUsers = useCallback(async (pageToFetch = 1) => {
    setLoading(true);
    let apiUrl = `/api/admin/users?q=${encodeURIComponent(query)}&page=${pageToFetch}&limit=${limit}`;
    if (roleFilter) apiUrl += `&role=${roleFilter}`;
    if (squadIdFilter) apiUrl += `&squadId=${encodeURIComponent(squadIdFilter)}`;
    if (hasSquadFilter) apiUrl += `&hasSquad=${hasSquadFilter}`;

    try {
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
        setTotalPages(data.totalPages || 1);
        setCurrentPage(data.currentPage || 1);
      } else {
        toast.error(data.error || 'Failed to fetch users');
        setUsers([]);
        setTotalPages(1);
        setCurrentPage(1);
      }
    } catch (err) {
      toast.error('Error fetching users');
      console.error('Fetch users error:', err);
      setUsers([]);
      setTotalPages(1);
      setCurrentPage(1);
    }
    setLoading(false);
  }, [query, limit, roleFilter, squadIdFilter, hasSquadFilter, setLoading, setUsers, setTotalPages, setCurrentPage]);

  // This useEffect handles fetching based on filters, pagination, and auth status
  useEffect(() => {
    if (status !== 'authenticated') return;
    const userWalletAddress = (session?.user as any)?.walletAddress;
    // Removed client-side admin check - API handles authentication
    fetchUsers(currentPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, (session?.user as any)?.walletAddress, query, roleFilter, squadIdFilter, hasSquadFilter, currentPage, limit, fetchUsers]);

  // This useEffect is for session-specific actions, now correctly using memoized fetchUsers
  useEffect(() => {
    if (session?.user && typeof fetchUsers === 'function') {
      // Consider if this initial call is truly needed given the other useEffect
      // fetchUsers(); 
    }
  }, [session?.user, fetchUsers]);

  // Opens the confirmation modal
  const initiatePurge = (user: UserRow) => {
    if (!user || (!user.walletAddress && !user._id)) {
      toast.error('Cannot purge user: No identifier (wallet or ID) found.');
      return;
    }
    setUserToPurge(user);
    setIsPurgeConfirmModalOpen(true);
  };

  // Actual purge logic, called on confirm from modal
  const executePurge = async () => {
    if (!userToPurge || (!userToPurge.walletAddress && !userToPurge._id)) return;

    setIsPurging(true);
    try {
      let deleteUrl = '/api/admin/users';
      if (userToPurge.walletAddress) {
        deleteUrl += `?wallet=${encodeURIComponent(userToPurge.walletAddress)}`;
      } else if (userToPurge._id) {
        deleteUrl += `?id=${encodeURIComponent(userToPurge._id.toString())}`;
      }

      const res = await fetch(deleteUrl, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success(`User ${userToPurge.xUsername || userToPurge.walletAddress?.substring(0,6) || ''} purged`);
        fetchUsers(); // Refresh the user list
      } else {
        toast.error(data.error || 'Failed to purge user');
      }
    } catch (err) {
      toast.error('Error purging user');
      console.error(err);
    }
    setIsPurging(false);
    setIsPurgeConfirmModalOpen(false);
    setUserToPurge(null);
  };

  const handleViewDetails = async (identifier: string) => {
    try {
      let apiUrl = '';
      const isLikelyObjectId = /^[a-f0-9]{24}$/i.test(identifier);

      if (isLikelyObjectId && !identifier.startsWith('0x')) { // Check if it's likely an ObjectId and not a wallet
        apiUrl = `/api/admin/users/id/${identifier}`;
      } else {
        apiUrl = `/api/admin/users/${identifier}`;
      }
      
      const res = await fetch(apiUrl);
      const data = await res.json(); // data = { user: UserDoc, recentActions: ..., recentNotifications: ... }
      if (res.ok && data.user) {
        // Flatten the structure to match FullUserDetail interface
        const fullDetail: FullUserDetail = {
          ...(data.user as any), // Spread all fields from the user document
          recentActions: data.recentActions,
          recentNotifications: data.recentNotifications,
        };
        setSelectedUser(fullDetail);
        setIsModalOpen(true);
      } else {
        toast.error(data.error || 'Failed to fetch user details');
      }
    } catch (err) {
      toast.error('Error fetching user details');
      console.error(err);
    }
  };

  const handleUserUpdate = (updatedUser: FullUserDetail) => {
    setUsers(prevUsers => 
      prevUsers.map(user => 
        (user._id === updatedUser._id || user.walletAddress === updatedUser.walletAddress) ? { ...user, ...updatedUser } : user
      )
    );
    // Optionally, if the modal is still open with this user, update selectedUser as well
    if (selectedUser && (selectedUser._id === updatedUser._id || selectedUser.walletAddress === updatedUser.walletAddress)) {
      setSelectedUser(prevSelected => prevSelected ? { ...prevSelected, ...updatedUser } : null);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    // fetchUsers(); // Replaced by local update via handleUserUpdate, or can be kept if full refresh is desired after any modal interaction
  };

  const handleFilterChange = () => {
    setCurrentPage(1); // Reset to page 1 when filters change
    // fetchUsers(1); // useEffect will trigger this due to filter state change
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // fetchUsers(newPage); // useEffect will trigger this due to currentPage change
    }
  };

  const handleUserCreated = (newUser: UserRow) => {
    // Prepend new user to list
    setUsers(prev => [newUser, ...prev]);
  };

  const userWalletAddress = (session?.user as any)?.walletAddress;
  if (status === 'loading') return <p className="p-10">Loading session...</p>;
  if (status !== 'authenticated') {
    return <p className="p-10 text-red-600">Please log in to access admin features</p>;
  }

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Admin – Users Management</h1>
      
      {/* Filter Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg bg-gray-50">
        <div>
          <label htmlFor="searchQuery" className="block text-sm font-medium text-gray-700">Search Wallet/Username/Email/ID</label>
          <input
            id="searchQuery"
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); handleFilterChange(); }}
            placeholder="Wallet, X Username, Email or ID"
            className="mt-1 border p-2 rounded w-full shadow-sm"
          />
        </div>
        <div>
          <label htmlFor="roleFilter" className="block text-sm font-medium text-gray-700">Role</label>
          <select 
            id="roleFilter" 
            value={roleFilter} 
            onChange={(e) => { setRoleFilter(e.target.value); handleFilterChange(); }}
            className="mt-1 border p-2 rounded w-full shadow-sm bg-white"
          >
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label htmlFor="squadIdFilter" className="block text-sm font-medium text-gray-700">Squad ID</label>
          <input
            id="squadIdFilter"
            type="text"
            value={squadIdFilter}
            onChange={(e) => { setSquadIdFilter(e.target.value); handleFilterChange(); }}
            placeholder="Enter exact Squad ID"
            className="mt-1 border p-2 rounded w-full shadow-sm"
            disabled={hasSquadFilter === 'false' || hasSquadFilter === 'true'} // Disable if hasSquad is used
          />
        </div>
        <div>
          <label htmlFor="hasSquadFilter" className="block text-sm font-medium text-gray-700">Has Squad?</label>
          <select 
            id="hasSquadFilter" 
            value={hasSquadFilter} 
            onChange={(e) => { setHasSquadFilter(e.target.value); setSquadIdFilter(''); handleFilterChange(); }} // Clear specific squadId if this changes
            className="mt-1 border p-2 rounded w-full shadow-sm bg-white"
          >
            <option value="">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>

      {/* Create User button - Reverted to original state */}
      <div className="mb-4 flex justify-end">
        <button onClick={()=>setIsCreateModalOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm">Create User</button>
      </div>

      {/* Table and Modal remain largely the same, but will use paginated data */}
      {loading ? (
        <p className="text-center py-10">Loading users...</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border text-sm table-auto">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2">ID</th>
                  <th className="p-2">Wallet</th>
                  <th className="p-2">Username</th>
                  <th className="p-2">Points</th>
                  <th className="p-2">Squad</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, index) => {
                  const displayId = (u._id as any)?.toString() || 'N/A';
                  const idForOps = u.walletAddress || displayId;
                  const isLikelyObjectId = /^[a-f0-9]{24}$/i.test(idForOps);
                  // Create unique key using MongoDB _id (guaranteed unique) or fallback to index
                  const uniqueKey = u._id ? u._id.toString() : `user-${index}`;
                  
                  // Role is now synced automatically in the database
                  const displayRole = u.role || 'user';
                  const isAdmin = displayRole === 'admin';

                  return (
                    <tr key={uniqueKey} className="border-t hover:bg-gray-50">
                      <td className="p-2 font-mono truncate max-w-xs" title={displayId}>{displayId.substring(0,8)}...</td>
                      <td className="p-2 font-mono truncate max-w-xs" title={u.walletAddress}>{u.walletAddress || '-'}</td>
                      <td className="p-2 truncate max-w-xs">{u.xUsername || '-'}</td>
                      <td className="p-2 text-right">{u.points?.toLocaleString() || 0}</td>
                      <td className="p-2 truncate max-w-xs" title={u.squadId}>{u.squadId || '-'}</td>
                      <td className="p-2">
                        <span className={isAdmin ? 'text-red-600 font-semibold' : ''}>
                          {displayRole}
                        </span>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <button
                          onClick={() => idForOps && handleViewDetails(idForOps)}
                          disabled={!idForOps}
                          className="text-blue-600 hover:underline text-xs mr-2 disabled:opacity-40"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => initiatePurge(u)}
                          className="text-red-600 hover:underline text-xs"
                        >
                          Purge
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                    <tr><td colSpan={6} className="text-center p-4 text-gray-500">No users found matching your criteria.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center space-x-2">
              <button onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="px-3 py-1 border rounded text-xs disabled:opacity-50">First</button>
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 border rounded text-xs disabled:opacity-50">Prev</button>
              <span className="text-xs">Page {currentPage} of {totalPages}</span>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1 border rounded text-xs disabled:opacity-50">Next</button>
              <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className="px-3 py-1 border rounded text-xs disabled:opacity-50">Last</button>
            </div>
          )}
        </>
      )}
      {isModalOpen && selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onUserUpdate={handleUserUpdate}
        />
      )}
      {/* Render the ConfirmationModal */}
      {isPurgeConfirmModalOpen && userToPurge && (
        <ConfirmationModal
          isOpen={isPurgeConfirmModalOpen}
          onClose={() => {
            setIsPurgeConfirmModalOpen(false);
            setUserToPurge(null);
          }}
          onConfirm={executePurge}
          title="Confirm User Purge"
          message={
            <p>
              Are you sure you want to purge user{' '}
              <strong className="font-mono">{userToPurge.xUsername || userToPurge.walletAddress?.substring(0, 8) || ''}...</strong>?
              This action cannot be undone.
            </p>
          }
          confirmButtonText="Purge User"
          isConfirming={isPurging}
        />
      )}
      {isCreateModalOpen && (
        <CreateUserModal isOpen={isCreateModalOpen} onClose={()=>setIsCreateModalOpen(false)} onUserCreated={handleUserCreated} />
      )}
    </main>
  );
} 