"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: "ADMIN" | "MEMBER";
  createdAt: Date;
  updatedAt: Date;
}

interface OrganizationListProps {
  currentOrganizationId?: string;
}

export function OrganizationList({ 
  currentOrganizationId 
}: OrganizationListProps) {
  const [error, setError] = useState("");
  
  const {
    data: organizations = [],
    isLoading,
    refetch,
  } = api.organization.getUserOrganizations.useQuery();

  if (isLoading) {
    return (
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600">Loading organizations...</p>
          </div>
        </div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
        <div className="text-center py-8">
          <h3 className="mb-2 text-lg font-medium text-gray-900">No organizations yet</h3>
          <p className="text-gray-600">Create your first organization to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-4 text-2xl font-bold text-gray-800">
        Your Organizations
      </h2>
      
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}
      
      <div className="space-y-3">
        {organizations.map((org: Organization) => (
          <div
            key={org.id}
            className={`rounded-lg border p-4 transition-colors hover:bg-gray-50 ${
              currentOrganizationId === org.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{org.name}</h3>
                <p className="text-sm text-gray-500">/{org.slug}</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  org.role === "ADMIN"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {org.role}
                </span>
              </div>
              
              <div className="flex space-x-2">
                <Link
                  href={`/organizations/${org.id}`}
                  className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
                >
                  View
                </Link>
                {currentOrganizationId === org.id && (
                  <span className="rounded-md bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                    Current
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}