"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";

interface OrganizationFormProps {
  onSuccess?: () => void;
}

export function OrganizationForm({ onSuccess }: OrganizationFormProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const utils = api.useUtils()
  
  const router = useRouter();
  const createOrganization = api.organization.create.useMutation({
    onSuccess: () => {
      setName("");
      setSlug("");
      setError("");
      setIsLoading(false);
      onSuccess?.();
      void utils.organization.getUserOrganizations.invalidate();
      router.refresh();
    },
    onError: (error) => {
      setError(error.message);
      setIsLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Generate slug from name if not provided
    const finalSlug = slug || name.toLowerCase().replace(/\s+/g, "-");
    
    createOrganization.mutate({
      name,
      slug: finalSlug,
    });
  };

  return (
    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-4 text-2xl font-bold text-gray-800">
        Create New Organization
      </h2>
      
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}
      
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
            placeholder="Acme Corp"
            required
          />
        </div>
        
        <div>
          <label htmlFor="slug" className="mb-1 block text-sm font-medium text-gray-700">
            Organization Slug (URL identifier)
          </label>
          <input
            type="text"
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="acme-corp"
          />
          <p className="mt-1 text-xs text-gray-500">
            If not provided, will be generated from the name
          </p>
        </div>
        
        <button
          type="submit"
          disabled={isLoading || !name.trim()}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isLoading ? "Creating..." : "Create Organization"}
        </button>
      </form>
    </div>
  );
}