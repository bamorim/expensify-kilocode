"use client";

import { api } from "~/trpc/react";
import Image from "next/image";
import Link from "next/link";

export function UserProfile() {
  const {
    data: session,
  } = api.auth.getSession.useQuery();

  const {
    data: organizations = [],
    isLoading,
  } = api.organization.getUserOrganizations.useQuery();

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-md">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-md">
        <div className="text-center py-8">
          <h3 className="mb-2 text-lg font-medium text-gray-900">Not authenticated</h3>
          <p className="text-gray-600">Please sign in to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-6 text-2xl font-bold text-gray-800">Your Profile</h2>
      
      <div className="mb-8">
        <div className="flex items-center space-x-4">
          {session.user.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name ?? "User"}
              width={80}
              height={80}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-300">
              <span className="text-2xl font-medium text-gray-600">
                {session.user.name?.charAt(0) ?? session.user.email?.charAt(0) ?? "U"}
              </span>
            </div>
          )}
          
          <div>
            <h3 className="text-xl font-medium text-gray-900">
              {session.user.name ?? "Unknown User"}
            </h3>
            <p className="text-gray-500">{session.user.email}</p>
          </div>
        </div>
      </div>
      
      <div>
        <h3 className="mb-4 text-lg font-semibold text-gray-800">Your Organizations</h3>
        
        {organizations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">You are not a member of any organizations yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
              >
                <div>
                  <h4 className="font-medium text-gray-900">{org.name}</h4>
                  <p className="text-sm text-gray-500">/{org.slug}</p>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    org.role === "ADMIN"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-gray-100 text-gray-800"
                  }`}>
                    {org.role}
                  </span>
                  
                  <Link
                    href={`/organizations/${org.id}`}
                    className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}