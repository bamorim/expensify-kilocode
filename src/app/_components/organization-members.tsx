"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import Image from "next/image";
import { UserRole } from "@prisma/client";
import { PermissionGuard } from "~/lib/authorization";
import { PERMISSIONS } from "~/server/permissions";

interface OrganizationMembersProps {
  organizationId: string;
}

export function OrganizationMembers({ organizationId }: OrganizationMembersProps) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const {
    data: members = [],
    isLoading,
    refetch: refetchMembers,
  } = api.organization.getMembers.useQuery({ organizationId });

  const {
    data: currentUserRole,
  } = api.organization.getUserRoleInOrganization.useQuery({ organizationId });

  const updateUserRole = api.userManagement.updateUserRole.useMutation({
    onSuccess: () => {
      setSuccess("User role updated successfully");
      setError("");
      void refetchMembers();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (error) => {
      setError(error.message);
      setSuccess("");
    },
  });

  const removeUserFromOrganization = api.userManagement.removeUserFromOrganization.useMutation({
    onSuccess: () => {
      setSuccess("User removed from organization successfully");
      setError("");
      void refetchMembers();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (error) => {
      setError(error.message);
      setSuccess("");
    },
  });

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    updateUserRole.mutate({
      userId,
      organizationId,
      role: newRole,
    });
  };

  const handleRemoveUser = (userId: string) => {
    if (confirm("Are you sure you want to remove this user from the organization?")) {
      removeUserFromOrganization.mutate({
        userId,
        organizationId,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600">Loading members...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-4 text-xl font-semibold text-gray-800">
        Organization Members
      </h2>
      
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-green-700">
          {success}
        </div>
      )}
      
      {members.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">No members found in this organization.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-center space-x-3">
                {member.user.image ? (
                  <Image
                    src={member.user.image}
                    alt={member.user.name ?? "User"}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300">
                    <span className="text-sm font-medium text-gray-600">
                      {member.user.name?.charAt(0) ?? member.user.email?.charAt(0) ?? "U"}
                    </span>
                  </div>
                )}
                
                <div>
                  <h3 className="font-medium text-gray-900">
                    {member.user.name ?? "Unknown User"}
                  </h3>
                  <p className="text-sm text-gray-500">{member.user.email}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  member.role === "ADMIN"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {member.role}
                </span>
                
                <PermissionGuard
                  role={currentUserRole}
                  permission={PERMISSIONS.MEMBER_UPDATE_ROLE}
                >
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.user.id, e.target.value as UserRole)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={updateUserRole.isPending}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </PermissionGuard>
                
                <PermissionGuard
                  role={currentUserRole}
                  permission={PERMISSIONS.MEMBER_REMOVE}
                >
                  <button
                    onClick={() => handleRemoveUser(member.user.id)}
                    className="rounded-md bg-red-600 px-2 py-1 text-sm text-white transition-colors hover:bg-red-700 disabled:bg-gray-400"
                    disabled={removeUserFromOrganization.isPending}
                  >
                    Remove
                  </button>
                </PermissionGuard>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}