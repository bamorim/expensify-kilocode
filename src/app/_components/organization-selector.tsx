"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: "ADMIN" | "MEMBER";
}

interface OrganizationSelectorProps {
  currentOrganizationId?: string;
  currentOrganizationName?: string;
}

export function OrganizationSelector({
  currentOrganizationId,
  currentOrganizationName,
}: OrganizationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  const {
    data: organizations = [],
    isLoading,
  } = api.organization.getUserOrganizations.useQuery();

  const { data: currentOrg } = api.organization.get.useQuery(
    { id: currentOrganizationId ?? "" },
    { enabled: !!currentOrganizationId }
  );

  const displayName = currentOrganizationName ?? currentOrg?.name ?? "Select Organization";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleOrganizationSelect = (organizationId: string) => {
    // Redirect to the selected organization page
    setIsOpen(false);
    router.push(`/organizations/${organizationId}`);
  };

  if (isLoading) {
    return (
      <div className="relative">
        <div className="flex h-10 w-48 items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
          <span className="text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="relative">
        <div className="flex h-10 w-48 items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
          <span className="text-gray-500">No Organizations</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-48 items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <span className="truncate font-medium">{displayName}</span>
        <svg
          className={`ml-2 h-4 w-4 transform transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-1 w-64 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            <div className="border-b border-gray-100 px-4 py-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Your Organizations
              </p>
            </div>
            {organizations.map((org: Organization) => (
              <button
                key={org.id}
                onClick={() => handleOrganizationSelect(org.id)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                  currentOrganizationId === org.id ? "bg-blue-50 text-blue-700" : "text-gray-700"
                }`}
              >
                <div>
                  <div className="font-medium">{org.name}</div>
                  <div className="text-xs text-gray-500">/{org.slug}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    org.role === "ADMIN"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-gray-100 text-gray-800"
                  }`}>
                    {org.role}
                  </span>
                  {currentOrganizationId === org.id && (
                    <svg
                      className="h-4 w-4 text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}