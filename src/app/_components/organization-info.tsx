"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { PermissionGuard } from "~/lib/authorization";
import { PERMISSIONS } from "~/server/permissions";

interface OrganizationInfoProps {
  organizationId: string;
}

export function OrganizationInfo({ organizationId }: OrganizationInfoProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  
  const {
    data: organization,
    isLoading,
    refetch,
  } = api.organization.get.useQuery({ id: organizationId });

  const {
    data: currentUserRole,
  } = api.organization.getUserRoleInOrganization.useQuery({ organizationId });

  const updateOrganization = api.organization.update.useMutation({
    onSuccess: () => {
      setIsEditing(false);
      setError("");
      void refetch();
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const handleUpdate = (data: { name?: string; slug?: string }) => {
    updateOrganization.mutate({
      id: organizationId,
      ...data,
    });
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600">Loading organization...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
        <div className="text-center py-8">
          <h3 className="mb-2 text-lg font-medium text-gray-900">Organization not found</h3>
          <p className="text-gray-600">The organization you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}
      
      {isEditing ? (
        <OrganizationEditForm
          organization={organization}
          onSave={handleUpdate}
          onCancel={() => setIsEditing(false)}
          isLoading={updateOrganization.isPending}
        />
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{organization.name}</h3>
            <p className="text-sm text-gray-500">/{organization.slug}</p>
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-700">Created</p>
                <p className="text-gray-500">
                  {new Date(organization.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Last Updated</p>
                <p className="text-gray-500">
                  {new Date(organization.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
          
          <PermissionGuard
            role={currentUserRole}
            permission={PERMISSIONS.ORG_UPDATE}
          >
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              Edit Organization
            </button>
          </PermissionGuard>
        </div>
      )}
    </div>
  );
}

interface OrganizationEditFormProps {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  onSave: (data: { name?: string; slug?: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function OrganizationEditForm({
  organization,
  onSave,
  onCancel,
  isLoading,
}: OrganizationEditFormProps) {
  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, slug });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
          Organization Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          required
        />
      </div>
      
      <div>
        <label htmlFor="slug" className="mb-1 block text-sm font-medium text-gray-700">
          Organization Slug
        </label>
        <input
          type="text"
          id="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          required
        />
      </div>
      
      <div className="flex space-x-2">
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}