"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

interface OrganizationMembersProps {
  organizationId: string;
}

export function OrganizationMembers({ organizationId }: OrganizationMembersProps) {
  const [error, setError] = useState("");
  
  const {
    data: members = [],
    isLoading,
    refetch,
  } = api.organization.getMembers.useQuery({ organizationId });

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
                  <img
                    src={member.user.image}
                    alt={member.user.name || "User"}
                    className="h-10 w-10 rounded-full"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300">
                    <span className="text-sm font-medium text-gray-600">
                      {member.user.name?.charAt(0) || member.user.email?.charAt(0) || "U"}
                    </span>
                  </div>
                )}
                
                <div>
                  <h3 className="font-medium text-gray-900">
                    {member.user.name || "Unknown User"}
                  </h3>
                  <p className="text-sm text-gray-500">{member.user.email}</p>
                </div>
              </div>
              
              <div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  member.role === "ADMIN"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {member.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}