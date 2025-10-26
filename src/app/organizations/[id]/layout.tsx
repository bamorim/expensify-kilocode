import { OrganizationSelector } from "~/app/_components/organization-selector";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

interface OrganizationLayoutProps {
  children: React.ReactNode;
  params: {
    id: string;
  };
}

export default async function OrganizationLayout({ children, params }: OrganizationLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    // This will be handled by the individual pages, but we include it here for completeness
    return null;
  }

  // Prefetch organization data for the selector
  void api.organization.getUserOrganizations.prefetch();
  void api.organization.get.prefetch({ id: params.id });

  return (
    <HydrateClient>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-gray-900">Organization Management</h1>
              <OrganizationSelector 
                currentOrganizationId={params.id}
              />
            </div>
          </div>
        </header>
        <main className="py-8">
          {children}
        </main>
      </div>
    </HydrateClient>
  );
}